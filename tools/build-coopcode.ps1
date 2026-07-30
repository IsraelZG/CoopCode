# Build sob demanda do CoopCode e instalacao isolada fora do repo.
#
# Uso:
#   rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-coopcode.ps1
#
# Resultado: C:\Dev2026\builds\coopcode\CoopCode.cmd inicia a build instalada
# com o OpenCode ARM64 fixado no PATH. Nada aqui roda automaticamente.

$ErrorActionPreference = 'Stop'

$repo       = Split-Path -Parent $PSScriptRoot
$orca       = Join-Path $repo 'apps\desktop\orca'
$unpacked   = Join-Path $orca 'dist\win-arm64-unpacked'
$opencode   = Join-Path (Split-Path -Parent $repo) 'external_repos\opencode\packages\opencode\dist\opencode-windows-arm64\bin\opencode.exe'
$install    = 'C:\Dev2026\builds\coopcode'
$current    = Join-Path $install 'current'
$previous   = Join-Path $install 'previous'

if (-not (Test-Path $opencode)) { throw "OpenCode ARM64 nao encontrado: $opencode" }

# Build: o --dir final e do electron-builder e gera apenas o unpacked (sem NSIS).
# Comando identico ao registrado em docs/planning/evidence/PLAT-009.md.
# O rebuild nativo do node-pty monta caminhos de 263 chars, e o MSBuild corta em
# 260 (MSB3491). O estouro vem do nome do diretorio da store virtual do pnpm
# ("node-pty@1.1.0_patch_hash=<hash>", 60 chars). Limitar esse nome a 30 derruba
# o caminho para ~233. So tem efeito no install, e o valor vale pelo env var
# porque nao existe flag de CLI para ele — e assim nao editamos o .npmrc do Orca.
# ponytail: subst nao resolve, realpath desfaz a unidade virtual e volta ao C:.
$env:npm_config_virtual_store_dir_max_length = '30'

Push-Location $orca
try {
  if (-not (Test-Path (Join-Path $orca 'node_modules'))) {
    & (Join-Path $PSScriptRoot 'pnpm-arm64.cmd') install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "pnpm install falhou com exit $LASTEXITCODE" }
  }
  & (Join-Path $PSScriptRoot 'pnpm-arm64.cmd') run build:win -- --arm64 --dir
  if ($LASTEXITCODE -ne 0) { throw "build:win falhou com exit $LASTEXITCODE" }
} finally { Pop-Location }
if (-not (Test-Path (Join-Path $unpacked 'Orca.exe'))) { throw "Orca.exe nao encontrado em $unpacked" }

# ponytail: exatamente uma build anterior e mantida. Se um dia precisares comparar
# tres versoes, troca a rotacao por um sufixo de data e um corte por contagem.
New-Item -ItemType Directory -Force -Path $install | Out-Null
if (Test-Path $previous) { Remove-Item $previous -Recurse -Force }
if (Test-Path $current)  { Move-Item $current $previous }

Copy-Item $unpacked $current -Recurse
New-Item -ItemType Directory -Force -Path (Join-Path $current 'opencode') | Out-Null
Copy-Item $opencode (Join-Path $current 'opencode\opencode.exe')

$sha   = (& git -C $repo rev-parse --short HEAD).Trim()
$dirty = [bool](& git -C $repo status --porcelain)
@{
  built_at   = (Get-Date).ToString('s')
  commit     = $sha
  dirty_tree = $dirty
  orca_ver   = (Get-Item (Join-Path $current 'Orca.exe')).VersionInfo.FileVersion
} | ConvertTo-Json | Set-Content (Join-Path $current 'build.json')

# Launcher estavel: o atalho nunca muda de caminho, so o conteudo de current\.
@"
@echo off
set "PATH=%~dp0current\opencode;%PATH%"
start "" "%~dp0current\Orca.exe" %*
"@ | Set-Content (Join-Path $install 'CoopCode.cmd') -Encoding ASCII

Write-Host ""
Write-Host "Instalado em $current  (commit $sha, dirty=$dirty)"
Write-Host "Rodar:    $install\CoopCode.cmd"
Write-Host "Rollback: mova previous\ para current\ ou rode previous\Orca.exe"
