#!/usr/bin/env bash
set -euo pipefail

dist=${1:-dist}
log_dir=${2:-artifacts}
app_dir="$dist/linux-arm64-unpacked"
mkdir -p "$log_dir"
test -x "$app_dir/orca-ide"
test -f "$app_dir/resources/node_modules/node-pty/build/Release/pty.node"
test -f "$app_dir/resources/agent-browser-linux-arm64"

for path in "$app_dir/orca-ide" "$app_dir/resources/node_modules/node-pty/build/Release/pty.node" "$app_dir/resources/agent-browser-linux-arm64"; do
  file "$path" | tee -a "$log_dir/orca-elf.log"
  readelf -h "$path" | grep -q 'AArch64'
done

appimage=$(find "$dist" -maxdepth 1 -type f -name '*arm64*.AppImage' -print -quit)
deb=$(find "$dist" -maxdepth 1 -type f -name '*arm64*.deb' -print -quit)
test -n "$appimage"
test -n "$deb"
dpkg-deb --field "$deb" Architecture | tee "$log_dir/orca-deb-architecture.log" | grep -qx arm64
sha256sum "$appimage" "$deb" | tee "$log_dir/orca-sha256sums.txt"
