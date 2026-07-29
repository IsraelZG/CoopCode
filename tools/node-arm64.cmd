@echo off
setlocal
set "PATH=%~dp0..\.toolchains\node-v24.18.0-win-arm64;%PATH%"
"%~dp0..\.toolchains\node-v24.18.0-win-arm64\node.exe" %*
exit /b %ERRORLEVEL%
