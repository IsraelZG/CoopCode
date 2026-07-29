@echo off
setlocal
set "PATH=%~dp0..\.toolchains\node-v24.18.0-win-arm64;%PATH%"
"%~dp0..\.toolchains\node-v24.18.0-win-arm64\node.exe" "%~dp0..\.toolchains\pnpm\node_modules\pnpm\bin\pnpm.cjs" %*
exit /b %ERRORLEVEL%
