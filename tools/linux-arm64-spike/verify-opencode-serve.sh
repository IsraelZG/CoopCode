#!/usr/bin/env bash
set -euo pipefail

binary=$1
log_dir=${2:-artifacts}
port=${OPENCODE_SPIKE_PORT:-4096}
mkdir -p "$log_dir"
test -x "$binary"
file "$binary" | tee "$log_dir/opencode-file.log"
file "$binary" | grep -Eq 'ARM aarch64|aarch64'

home_dir=$(mktemp -d)
cleanup() {
  if [[ -n "${pid:-}" ]]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
  rm -rf "$home_dir"
}
trap cleanup EXIT

HOME="$home_dir" XDG_CONFIG_HOME="$home_dir/config" XDG_DATA_HOME="$home_dir/data" XDG_CACHE_HOME="$home_dir/cache" XDG_STATE_HOME="$home_dir/state" OPENCODE_PURE=1 OPENCODE_DISABLE_AUTOUPDATE=1 OPENCODE_DISABLE_AUTOCOMPACT=1 OPENCODE_DISABLE_MODELS_FETCH=1 OPENCODE_DISABLE_PROJECT_CONFIG=1 OPENCODE_AUTH_CONTENT='{}' "$binary" serve --hostname 127.0.0.1 --port "$port" --pure --log-level ERROR >"$log_dir/opencode-server.stdout.log" 2>"$log_dir/opencode-server.stderr.log" &
pid=$!
for _ in {1..120}; do
  curl --fail --silent --show-error "http://127.0.0.1:$port/global/health" >"$log_dir/opencode-health.json" && break
  kill -0 "$pid" || { cat "$log_dir/opencode-server.stderr.log"; exit 1; }
  sleep 0.25
done
grep -q '"healthy":true' "$log_dir/opencode-health.json"
