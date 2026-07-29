@echo off
setlocal

for %%I in ("%~dp0..\..") do set "DEV_ROOT=%%~fI"
set "OPENCODE_BIN=%DEV_ROOT%\external_repos\opencode\packages\opencode\dist\opencode-windows-arm64\bin"
for %%I in ("%~dp0..\apps\desktop\orca") do set "ORCA_DIR=%%~fI"
set "PACKAGED_ORCA=%ORCA_DIR%\dist\win-arm64-unpacked\Orca.exe"

if not exist "%OPENCODE_BIN%\opencode.exe" (
  echo OpenCode ARM64 nao encontrado em "%OPENCODE_BIN%\opencode.exe".
  exit /b 1
)

set "PATH=%OPENCODE_BIN%;%PATH%"
cd /d "%ORCA_DIR%"

where opencode
if errorlevel 1 exit /b %ERRORLEVEL%

if /i "%~1"=="--check" exit /b 0

if /i "%~1"=="--packaged" (
  if not exist "%PACKAGED_ORCA%" (
    echo Orca ARM64 empacotado nao encontrado em "%PACKAGED_ORCA%".
    exit /b 1
  )
  "%PACKAGED_ORCA%"
  exit /b %ERRORLEVEL%
)

call "%~dp0pnpm-arm64.cmd" start
exit /b %ERRORLEVEL%
