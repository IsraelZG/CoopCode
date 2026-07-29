@echo off
setlocal
set "PATH=%~dp0..\.toolchains\node-v24.18.0-win-arm64;%PATH%"
set "npm_config_msvs_version=2022"
"%USERPROFILE%\.bun\bin\bun.exe" %*
exit /b %ERRORLEVEL%
