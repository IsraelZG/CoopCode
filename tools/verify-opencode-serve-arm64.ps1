[CmdletBinding()]
param(
    [string]$BinaryPath,
    [ValidateRange(1, 65535)]
    [int]$Port = 4096,
    [ValidateRange(1, 120)]
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($BinaryPath)) {
    $BinaryPath = Join-Path $PSScriptRoot "..\..\external_repos\opencode\packages\opencode\dist\opencode-windows-arm64\bin\opencode.exe"
}
$binary = (Resolve-Path -LiteralPath $BinaryPath).Path
$healthUri = "http://127.0.0.1:$Port/global/health"
$server = $null

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

if (-not (Test-PortAvailable -CandidatePort $Port)) {
    throw "A porta $Port já está em uso."
}

try {
    $hadServerPassword = Test-Path Env:OPENCODE_SERVER_PASSWORD
    $serverPassword = $env:OPENCODE_SERVER_PASSWORD
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $binary
    $startInfo.Arguments = "serve --hostname 127.0.0.1 --port $Port --pure --log-level ERROR"
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true

    $server = [Diagnostics.Process]::new()
    $server.StartInfo = $startInfo
    try {
        Remove-Item Env:OPENCODE_SERVER_PASSWORD -ErrorAction SilentlyContinue
        if (-not $server.Start()) {
            throw "Não foi possível iniciar OpenCode."
        }
    }
    finally {
        if ($hadServerPassword) {
            $env:OPENCODE_SERVER_PASSWORD = $serverPassword
        }
    }

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $health = $null

    while ([DateTime]::UtcNow -lt $deadline) {
        if ($server.HasExited) {
            throw "OpenCode encerrou antes do health check. Exit code: $($server.ExitCode)."
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
        throw "Timeout aguardando $healthUri."
    }

    [PSCustomObject]@{
        Result  = "PASS"
        Pid     = $server.Id
        Uri     = $healthUri
        Healthy = $health.healthy
        Version = $health.version
    } | Format-List
}
finally {
    if ($null -ne $server -and -not $server.HasExited) {
        $server.Kill()
        $null = $server.WaitForExit(5000)
    }

    $releaseDeadline = [DateTime]::UtcNow.AddSeconds(5)
    while (
        -not (Test-PortAvailable -CandidatePort $Port) -and
        [DateTime]::UtcNow -lt $releaseDeadline
    ) {
        Start-Sleep -Milliseconds 100
    }

    if (-not (Test-PortAvailable -CandidatePort $Port)) {
        throw "O processo encerrou, mas a porta $Port não foi liberada."
    }

    Write-Host "Shutdown: PASS (processo encerrado; porta $Port liberada)"
    if ($null -ne $server) {
        $server.Dispose()
    }
}
