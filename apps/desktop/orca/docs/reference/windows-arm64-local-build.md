# Windows arm64 Local Build Pitfalls

Producing a packaged build outside CI (`pnpm run build:win --dir`, or the
`tools/build-coopcode.ps1` deploy script) on a fresh checkout hits three
environment gaps that don't show up inside a `prepare-task.mjs` worktree or
in CI. None of these are caused by application code — they're pre-existing
gaps in local build tooling, found 2026-08-05 while producing the first
CoopCode package build since 2026-07-30.

## 1. Missing `.toolchains/` in a fresh main-repo checkout

`tools/pnpm-arm64.cmd` resolves
`%~dp0..\.toolchains\node-v24.18.0-win-arm64\node.exe`. If that directory
doesn't exist, the wrapper fails with a bare "O sistema não pode encontrar o
caminho especificado." (or the English equivalent) and a nonzero exit code —
no further diagnostic, and every `pnpm-arm64.cmd` invocation (build, test,
lint) fails the same way.

`.toolchains/` is gitignored and is **not** populated for a fresh main-repo
checkout — only some task worktrees happen to already have it. Its contents
are just symlinks to the system-installed Node/pnpm
(`node-v24.18.0-win-arm64 -> C:\Program Files\nodejs`,
`pnpm/node_modules -> ...\npm\node_modules`), not real per-architecture
binaries, despite the versioned folder name.

**Fix:** copy `.toolchains/` from any worktree that already has it (e.g. one
prepared via `tools/coop-dev/prepare-task.mjs`) into the checkout root.
Confirm with `tools/pnpm-arm64.cmd --version`.

## 2. `build:win`'s typecheck gate blocks packaging on unrelated, pre-existing errors

`build:win` → `build:desktop` → `pnpm run typecheck`, and as of 2026-08-05
that's ~8 pre-existing TS errors unrelated to whatever change triggered the
build (ai-vault test mocks, an unused import in `preload/index.ts`, etc. —
none in the files actually being touched). `pnpm run typecheck` treats any
of these as fatal and aborts the whole `build:win` chain before packaging
even starts.

`package.json`'s own `build:release` script already skips `typecheck` for
exactly this reason.

**Fix:** to produce a package build without first fixing every unrelated
pre-existing error, run `build:desktop`'s remaining steps by hand —
`build:relay && build:cli && build:electron-vite && build:web-from-renderer`
— skipping the standalone `pnpm run typecheck` invocation, then
`ensure:electron-runtime` and
`electron-builder --config config/electron-builder.config.cjs --win --arm64 --dir`.

This is a workaround, not permission to ignore the errors — they're real
debt and worth a cleanup pass; this just keeps them from blocking an
otherwise-unrelated packaging run.

## 3. electron-builder forces a node-pty native rebuild via MSBuild arm64, which can fail silently

Packaging with `electron-builder --win --arm64` invokes its own internal
native-module rebuild (`config/scripts/electron-builder-native-rebuild.cjs`
→ `rebuild-native-deps.mjs --force`) regardless of whether the
already-installed `node-pty` binary is already correct for the target
Electron/arch. On at least one machine the arm64 MSBuild toolchain failed
partway through linking `winpty`/`winpty-agent` with no clear diagnostic
(`MSBuild.exe failed with exit code: 1`, only compiler warnings printed
before it).

`rebuild-native-deps.mjs` already has an escape hatch for this, just
undocumented: set `ORCA_REUSE_PREPARED_NATIVE_RUNTIME=1` before invoking
`electron-builder`, when the packaging target platform/arch match the host.
It runs an independent load probe first
("Native modules already load in Electron; skipping rebuild.") instead of
forcing a `node-gyp` rebuild.

**Fix:** set `ORCA_REUSE_PREPARED_NATIVE_RUNTIME=1` when repackaging on a
machine where node-pty is already known-good for the current Electron
version — don't reach for a Visual Studio Build Tools fix first.

## 4. New runtime-external packages must be registered in `packaged-runtime-node-modules.cjs`

`config/packaged-runtime-node-modules.cjs`'s `afterPack` check
(`verifyPackagedMainRuntimeDeps`) scans the packaged main bundle for bare
`require(...)` calls and fails packaging if any resolve to a package whose
`node_modules` folder wasn't copied into `resources/`. Its allowlist
(`PACKAGED_RUNTIME_PACKAGE_ROOTS`) is not auto-derived from imports — it's
hand-maintained, and it hadn't been updated when `@opencode-ai/sdk`
(`main/opencode-sdk/client.ts`, added for the opencode-sessions feature) was
introduced as a real (value-level) runtime import, so packaging failed with
`Packaged main bundle has bare runtime imports without copied node_modules: node:sqlite, @opencode-ai/sdk`.

Separately, `node:sqlite` failed the same check because Node 22's static
`builtinModules` array doesn't list it (still experimental), even though the
module is importable — so the check's builtin-recognition treated it as an
unresolved external package instead of a core module.

**Fix (already applied, 2026-08-05):** `@opencode-ai/sdk` was added to
`PACKAGED_RUNTIME_PACKAGE_ROOTS`, and any `node:`-prefixed specifier is now
treated as a builtin unconditionally (that prefix is reserved for core
modules by Node's own convention, regardless of what a given Node version's
`builtinModules` array happens to list).

**When this recurs:** any future dependency added as a real (non-`import
type`) import in a `src/main/**` file that isn't already bundled by
electron-vite needs its package name added to
`PACKAGED_RUNTIME_PACKAGE_ROOTS` in `config/packaged-runtime-node-modules.cjs`
— otherwise packaging succeeds locally (dev/test never exercises the packaged
`asar`) and only fails at `electron-builder`'s `afterPack` step, which is easy
to skip noticing if nobody has produced a full package build recently.
