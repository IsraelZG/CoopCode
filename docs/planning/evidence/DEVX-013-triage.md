# DEVX-013 — Triage of the Orca suite failures

Classifies every failing file from the 2026-07-31 full-suite run (see the
rewritten `BASELINE.md`) as **signal** (a real defect, worth a task) or
**noise** (an artifact of importing the Orca snapshot, or of this specific
host/environment, with no bearing on this project's own code). This task does
not fix anything and does not open new task specs — see `Handoff` at the end.

## Method and a correction to the plan

Criterion 1 asks to re-run the full suite and record counts. On this host the
suite **cannot self-report**: `pnpm run test` ran all 3695 files to completion
(every file has a reporter line) but the `vitest` process then hung at
teardown — zero CPU delta across the 3 surviving node processes over a 45s
sample, log frozen 12+ minutes — before it could print its summary or write
`--reporter=json`. The counts in `BASELINE.md` are derived line-by-line from
the reporter log, not from a clean summary; that is stated there explicitly.
The suite was **not** re-run by this task beyond that one already-captured
attempt (re-running would hang the same way and burn the time budget for
nothing, per the task's own instruction).

Because the log/stderr artifacts from that killed run contain no assertion
diffs (the run died before the "Failed Tests" report section could print),
every one of the 51 failing files below was **re-confirmed individually** with
the sanctioned single-file command:

```
tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts <path>
```

(from `apps/desktop/orca`, with `npm_config_virtual_store_dir_max_length=30`
set), except `config/scripts/resolve-7za-path.test.mjs`, which was deliberately
**not** re-run — see its entry below — to avoid re-triggering the same hang.

## Whole-suite hang — its own finding, not a per-file line

**Signal.** The full suite hangs at teardown on this host and never reaches
its own summary/JSON output, so criterion 1 cannot be satisfied as literally
written; this is very likely what made the suite look "stuck" to the previous
worker. The strongest candidate is `config/scripts/resolve-7za-path.test.mjs`
(see below): several of its tests call `app-builder-lib`'s `getPath7za()`,
which performs a real subprocess/toolset-download operation with no host-level
timeout beyond the individual `it()`'s own 120s/300s override, and `7zip-bin`
is not installed in `node_modules` on this host so the legacy-binary fast path
never applies. No existing task in `docs/coop/tasks/` covers this; a follow-up
task should either mock the toolset resolution in tests or add a hard
kill-timeout wrapper around the suite invocation itself.

## Signal cluster: `node:path.join` corrupts POSIX-style logical paths on Windows

The single most important pattern in this triage. Several unrelated modules
combine a **logical/POSIX-style path** (an SSH-managed home, a virtual
document root, a value the code itself normalizes with `/`) using `node:path`'s
platform-native `join`, which unconditionally emits backslashes on Windows.
Downstream string comparisons against the original forward-slash value then
silently fail — no throw, just an empty/`null` result — so real functionality
quietly breaks only on Windows. Confirmed independently in three files
(`codex-session-resume-home.ts` via its test, `ai-vault` RPC method via its
test, and dead code in `node-markdown-document-discovery.ts`), plus likely
contributors in `worktree-base-directory-event-filter.ts`/`-watcher.ts` and
`repo-detection.ts`. No existing task in `docs/coop/tasks/` covers any of
this; recommend one task to audit `node:path` usage against the project's own
`src/shared/cross-platform-path.ts` helpers, prioritizing
`codex-session-resume-home.ts` (breaks real Codex session resume on Windows)
and `worktree-base-directory-event-filter.ts` (breaks worktree file-watch
classification on Windows).

## Per-file triage

| File | Class | Reason |
|---|---|---|
| `config/scripts/generate-bundled-skill-guides.test.mjs` | noise | Asserts a thrown message contains the POSIX path `src/cli/bundled-skill-guides.ts`; the real message correctly reports the same path with Windows separators (`src\cli\...`) — cosmetic only. |
| `config/scripts/generate-skill-bundle-manifest.test.mjs` | noise | "computes the same Git tree identity as Git" compares against `undefined`; Git prints `warning: LF will be replaced by CRLF` lines ahead of the tree SHA on this `core.autocrlf`-enabled Windows checkout, and the test's own regex extraction of Git's output breaks against that extra output. |
| `config/scripts/mobile-pairing-qrcode-import-plugin.test.mjs` | noise | Both tests: `spawnSync(oxlintPath, ...)` throws `EINVAL` — Node's `spawnSync` of a `.cmd` file on Windows requires `shell: true`/`windowsVerbatimArguments`; the test's own runner lacks it. |
| `config/scripts/pr-workflow-parallelism.test.mjs` | signal | "keeps every real-zsh test in the dedicated shell lane" — the file-discovery helper returns backslash-separated paths on Windows while the expected list is hardcoded forward-slash; same `node:path`-on-Windows family as the main cluster, low severity (CI tooling script only, not shipped product code). What would change: normalize discovered paths to `/` before comparing, or compare via a path-flavor-neutral helper. No existing task covers it. |
| `config/scripts/resolve-7za-path.test.mjs` (0 tests reported) | signal | Not re-run in isolation (risk of re-triggering the hang). Several tests call `app-builder-lib`'s real `getPath7za()` toolset resolver (subprocess exec / possible network download) with no `7zip-bin` package installed locally to short-circuit it; this is the leading candidate for the whole-suite teardown hang described above. What would change: mock `app-builder-lib`'s toolset resolution in tests, or give the whole-suite invocation itself a hard external kill-timeout. No existing task covers it. |
| `config/scripts/trim-windows-icon-source.test.mjs` (0 tests reported) | noise | Re-run alone (safe: pure synchronous PNG/ICO math, no subprocess or network I/O) still fails immediately with `SyntaxError: Invalid or unexpected token` during vitest's own collection step, reproducible even after clearing `node_modules/.vite`. Both the test file and its implementation independently parse and import cleanly under plain Node ESM (`node --check`, dynamic `import()`), so the defect is in vitest's transform/collection pipeline on this host, not in the source. Root cause not further isolated within this task's budget (out of scope: classify, not fix). |
| `src/main/ai-vault/session-scanner-crush-cleanup.test.ts` ("falls back to ps when /proc is unavailable (macOS)") | noise (carried verbatim, not a vitest failure this run) | Per this task's criterion 3: 3 pre-existing TS type errors, confirmed byte-identical to base commit `9ce5d97d9` via `git show`, found during `DEVX-012`. This is a typecheck-only finding (not caught by `vitest run`, which doesn't type-check), so it does not appear as one of the 51 failing files in this run's counts — noted here per the task's explicit instruction to carry it through. |
| `src/main/ai-vault/session-scanner-scope.test.ts` | noise (carried verbatim) | Per criterion 3: confirmed pre-existing via `git stash push -u`/`pop` bisection against commit `fc0af2b40` during `DEVX-012`'s rework. Not re-investigated. |
| `src/main/ai-vault/session-scanner-values.test.ts` | noise (carried verbatim) | Same as above — confirmed pre-existing via the same `DEVX-012` bisection. Not re-investigated. |
| `src/main/ai-vault/session-scanner.test.ts` ("indexes every supported agent") | noise (carried verbatim) | Same as above — confirmed pre-existing via the same `DEVX-012` bisection. Not re-investigated. |
| `src/main/cli/linux-bare-orca-dispatcher.test.ts` | noise | Asserts the written dispatcher file's mode has an exec bit (`mode & 0o111`); NTFS has no POSIX permission bits, so `chmod`'s effect is unverifiable on Windows regardless of whether the code is correct — this code path only matters on real Linux hosts. |
| `src/main/cli/linux-terminal-orca-cli-shim.test.ts` | noise | Same NTFS exec-bit limitation as above (2 sub-failures). |
| `src/main/codex/codex-session-resume-home.test.ts` | signal | 9 of 28 tests fail: `resolveTrustedCodexSessionResumeHome`/`findTrustedCodexSessionResume` return `null` instead of the expected home, because `join(homePath, 'sessions')` (node:path) turns a POSIX-style recorded home like `/managed/account/home` into `\managed\account\home\sessions` on Windows, which no longer matches the forward-slash transcript path during prefix comparison. Part of the `node:path.join` cluster above. What would change: build the sessions-root path with the project's own flavor-aware path join (`src/shared/cross-platform-path.ts`) instead of `node:path`'s `join`. No existing task covers it. |
| `src/main/codex/codex-session-resume-preparation.test.ts` | signal | 2 failures, downstream of the same bug: `prepareCodexSessionResume` falls back to `{outcome:'fresh'}` instead of `{outcome:'resume', codexHomePath}` because the home-resolution call above returns `null`. Same fix as `codex-session-resume-home.test.ts`. No existing task covers it. |
| `src/main/daemon/daemon-preflight-client-replacement.test.ts` | noise | Both failures: `listen EACCES: permission denied` binding a named pipe under a temp directory — a sandbox/permission limitation of this specific run environment, not exercised code logic. |
| `src/main/daemon/pty-subprocess-foreground-scan-cadence.test.ts` | noise | Passes cleanly (0 failures) when re-run standalone; its 4 failures in the full-suite run are attributable to cross-test load/order effects in that run, not a defect of the file itself. |
| `src/main/daemon/pty-subprocess.test.ts` | signal | "preserves a daemon-owned custom Codex home..." — `env.CODEX_HOME` is `undefined` instead of the expected value, the same downstream symptom as the Codex resume-home cluster (home resolution silently returns nothing on Windows). No existing task covers it. |
| `src/main/devin/hook-service.test.ts` | noise | Asserts the installed hook script's content is the POSIX `curl`/`printf` script; the installer correctly emits a Windows batch-script equivalent (verified to carry the same curl invocation, endpoint, and token handling, just in `.cmd` syntax) — the test isn't parameterized per platform. |
| `src/main/durable-file-write-syscall-proof.test.ts` | noise | The test's own `directoryFsyncSupported()` probe says directory-fsync is unsupported on this host, but the real `writeFileDurableSync` performs the directory fsync anyway and it succeeds without error — the test's platform assumption ("Windows cannot fsync a directory") is stale for this host; production behavior is safe (an extra durability step, not a missing one). |
| `src/main/ephemeral-vm-runtime-service.test.ts` | noise | Both failures: `spawn /bin/sh ENOENT`. The test spoofs `process.platform = 'linux'` to exercise the Linux code path, but the real OS is still Windows, which has no `/bin/sh` — real Linux hosts have this binary. |
| `src/main/git/repo-detection.test.ts` | signal | 2 failures: `getGitRepoRoot` returns a forward-slash path (`C:/Users/.../nested-root-real`) when Git itself is unavailable, but the test (and other native-path consumers) expect the native backslash form Windows paths normally take. Part of the path-separator family. What would change: normalize the git-unavailable fallback's returned path to native separators before returning. No existing task covers it. |
| `src/main/ipc/ephemeral-vm.test.ts` | noise | Same `process.platform` spoof + real absent `/bin/sh` as `ephemeral-vm-runtime-service.test.ts` above (surfaces as an unhandled rejection rather than a direct assertion failure, but same cause). |
| `src/main/ipc/filesystem-watcher-local-unsubscribe.test.ts` | noise | Test fixtures use a literal POSIX-style local path (`/tmp/repo`) as if it were a real local worktree path; real `fs`/path resolution on Windows naturally turns it into `C:\tmp\repo`, which no longer matches the mocks keyed on the original string, cascading into 3 genuine 30s test-level timeouts as retries wait on callbacks that can never fire. Unlike the `node:path.join` cluster, this is unrealistic test data (no real local Windows worktree path would ever look like `/tmp/repo`), not a logic defect. |
| `src/main/ipc/native-chat.test.ts` | noise | 3 failures: the tests point the transcript resolver at a fixture by setting `process.env.HOME`, but Node's `os.homedir()` ignores `HOME` on Windows (uses `USERPROFILE`), so the resolver reads the real user's actual home directory instead of the fixture and finds nothing. |
| `src/main/ipc/pty.test.ts` | signal | 1 of 391 tests: the sequenced startup command env var is left as bare `'codex'` instead of `"codex 'resume' '<id>'"` — the same Codex resume-home resolution failure surfacing through the PTY spawn-env path. No existing task covers it. |
| `src/main/ipc/worktree-base-directory-event-filter.test.ts` | signal | `matchingWorktreeBaseRepoIds` returns empty `structureRepoIds`/`gitStatusRepoIds`/`headIdentityRepoIds` for inputs that should classify — the highest-severity instance of the path-separator cluster: this breaks real-time worktree git-state file-watch classification on Windows. What would change: audit the path-matching/segment logic in this module against `src/shared/cross-platform-path.ts` for a `node:path`-style separator assumption. No existing task covers it. |
| `src/main/ipc/worktree-base-directory-watcher.test.ts` | signal | 13 failures cascading from the same root cause as the event-filter test above: poller lookups fail with `No poller callback for \workspace\worktrees` (root keyed with the wrong separator), and downstream mock-call assertions fail in turn. Same fix as the event-filter file; no existing task covers it. |
| `src/main/kimi/hook-service.test.ts` | noise | Same platform-specific hook-script issue as `devin/hook-service.test.ts`: expects a `.sh` script, the installer correctly writes the Windows equivalent. |
| `src/main/native-chat/transcript-read-cache.test.ts` | noise | Same `process.env.HOME`-ignored-by-`os.homedir()`-on-Windows issue as `native-chat.test.ts` (3 failures, the injected read-spy is simply never reached). |
| `src/main/native-chat/transcript-watch-error.test.ts` | signal | Both failures: reading a directory placed at the transcript path is meant to surface `"Transcript unavailable"` as the 4th snapshot argument, but on this host it surfaces `undefined` (plus an extra `undefined` 5th argument) instead — the directory/EISDIR-style error isn't recognized the same way cross-platform, so the friendly degraded-UX message is silently dropped for Windows users. No existing task covers it. |
| `src/main/rate-limits/service.test.ts` | signal | 7 failures, reproduced deterministically standalone (not order-dependent): built request options unexpectedly include `allowUsagePanelSupplement: false` (expected `true`) and a stray `networkProxySettings` value across several distinct test cases (Gemini/OpenCode Go fetch, WSL target, PTY-fallback variants, Fable supplements). Needs a dedicated look at the service's default-options/test-fixture resolution; no existing task covers it. |
| `src/main/runtime/orca-runtime-files.test.ts` | signal | 2 distinct real bugs: (1) "opens IPv4 loopback local POSIX terminal links" produces a malformed `absolutePath` — `"//127.0.0.1C:\\Users\\...\"` — missing a separator between the loopback prefix and the drive letter, so `exists` comes back `false` for a file that's actually there; (2) "translates WSL temp artifacts before granting the exact path" genuinely times out at vitest's 30s `testTimeout` — a real per-test hang (bounded, unlike the whole-suite hang) most likely from a WSL-path-translation step that tries to reach real `wsl.exe`/filesystem state unavailable in this environment. No existing task covers either. |
| `src/main/runtime/rpc/methods/ai-vault.test.ts` | signal | Both failures: `additionalCodexSessionsDirs` contains `'\runtime\codex\home\sessions'` where the test expects `'/runtime/codex/home/sessions'` — another confirmed instance of the `node:path.join` cluster. Same fix direction as the Codex resume-home entries. No existing task covers it. |
| `src/main/speech/stt-service.test.ts` | noise | All 20 failures: `Cannot find module 'sherpa-onnx-win32-arm64'` — this optional native speech-to-text dependency isn't installed for win32-arm64 in this checkout; a known ARM64-Windows packaging gap (`BASELINE.md`'s "Empacotamento Windows ARM64" section documents related native-rebuild friction on this platform), not a logic defect. |
| `src/main/ssh/ssh-remote-node-resolution.test.ts` | noise | `spawnSync('/bin/sh', ...)` throws `ENOENT` — the test drives a local subprocess to emulate shell-dotfile parsing, but in production this command runs on the *remote* SSH host (which has `/bin/sh`), never on the local Windows client. |
| `src/main/startup/desktop-startup-ordering.test.ts` | noise | Asserts a since-renamed identifier (`managedWslCliReconciliationReady`) is absent from a raw source-text slice; the code was legitimately renamed to `managedWslCliStartupBarrierReady` in a later refactor and the test fixture wasn't updated — stale source-text assertion, not a behavior change. |
| `src/main/startup/serve-desktop-activation-wiring.test.ts` | noise | Same source-text-drift pattern: searches for a specific function-name string in raw source that no longer appears verbatim after a refactor. |
| `src/main/window/clipboard-file-copy.test.ts` | noise | 4 failures across macOS/KDE/GNOME clipboard-format tests: fake POSIX test paths (`/repo/a.png`) get a `C:` drive prefix from real Windows path resolution during the test (`file:///C:/repo/...` instead of `file:///repo/...`); these code paths never execute on a real Windows host in production. |
| `src/relay/agent-exec-handler.test.ts` | noise | `spawnMock` is called with a real resolved path (`C:\Users\israe\.grok\bin\agent.exe`) instead of the literal `'agent'` the test expects — this developer workstation has a real Grok CLI installed on `PATH`, which the command-resolution logic (correctly) finds; a clean CI environment without that real tool installed would not hit this. |
| `src/relay/pty-handler.test.ts` | noise | All 15 failures: `mockKill` is called with no arguments instead of `'SIGTERM'`/`'SIGKILL'` — Windows ConPTY's `kill()` takes no signal parameter (Windows has no POSIX signal delivery to a PTY), so the code correctly omits it there; the tests assert the POSIX call signature unconditionally. |
| `src/relay/rotating-log-writer.test.ts` | signal | "leaves the original streams active when the log cannot be opened" — pointing the log path at a directory is expected to fail synchronously and leave `writer.active === false`, but on this host it reports `active: true` instead, meaning the safety fallback to original stdout/stderr may not engage reliably cross-platform when the log path is invalid. What would change: detect an invalid/directory log path with a synchronous `stat` check before opening, rather than relying on the write-stream's async error-event timing. No existing task covers it. |
| `src/renderer/src/components/editor/monaco-content-sync.undo-history.test.ts` | signal | Model content comes back with `\r\n` line endings (`'first line\r\nappended'`) where `\n` was written and expected; Monaco's text model appears to default to CRLF on this Windows host, which could cause spurious diffs when saved content round-trips through the editor. What would change: explicitly force LF (`model.setEOL(...)`) when the model is created, independent of host OS. No existing task covers it. |
| `src/renderer/src/components/github-item-dialog-source-boundary.test.ts` | noise | Asserts an exact raw-source whitespace/indentation slice (`'if (removed) {\n    workItemDetailsCacheGeneration += 1'`) that no longer matches after a legitimate reformat of the same logic; behavior unchanged. |
| `src/renderer/src/components/pull-request-page-host-boundary.test.ts` | noise | Same exact-source-text/whitespace drift as the GitHub-item-dialog test above (identical expected string, identical cause). |
| `src/renderer/src/components/right-sidebar/SourceControl.host-context-boundary.test.ts` | noise | Same source-text-drift family: expects an exact call-site text fragment that shifted (added comment, minor reformat) in a later refactor. |
| `src/renderer/src/components/status-bar/resource-session-classification-parity.test.ts` | noise | Same source-text-drift family: checks that specific field names are absent from a raw merge-call source slice; the current component's source no longer contains the searched text in the same shape. |
| `src/renderer/src/i18n/no-top-level-translate.test.ts` | noise | Passes cleanly (0 failures) when re-run standalone; its failure in the full-suite run is attributable to load/timing under that run, not a defect of the file itself. |
| `src/shared/automation-schedules.test.ts` | signal | `formatAutomationSchedule('30 12 * * 7')` returns `'domingos at 12:30'` instead of `'Sundays at 12:30'` — the weekday name is produced via a locale-dependent formatter (likely `Intl`/`toLocaleString` without pinning `'en-US'`), so it silently follows this OS's locale (pt-BR) instead of the app's intended English label. What would change: pin the locale explicitly wherever this label is generated. No existing task covers it. |
| `src/shared/external-automation-jobs-file.test.ts` | signal | Same locale-leak family: the thrown message reads `"more than 10.000 jobs"` (EU/pt-BR thousands separator) instead of `"more than 10,000 jobs"` — a number is formatted with the host locale instead of a pinned one. Same fix direction as `automation-schedules.test.ts`. No existing task covers it. |
| `src/shared/feature-interactions.test.ts` | noise | Passes cleanly (0 failures) when re-run standalone; its failure in the full-suite run is attributable to load/timing under that run, not a defect of the file itself. |
| `src/shared/node-markdown-document-discovery.test.ts` | signal | Both failures are the same `node:path.join` cluster bug: recursive directory lookups built via `join(absoluteDirectoryPath, entry.name)` produce backslash-joined keys that don't match the test's forward-slash-keyed synthetic `readDirectory`. This module is not currently imported anywhere outside its own test (`grep` across `src/` finds no other reference), so it has no live user impact yet, but it is a real latent bug that will resurface the moment it's wired to any POSIX-style/remote root while running on Windows. No existing task covers it. |
| `tests/e2e/helpers/nested-runtime-proxy-jump-fixture.unit.test.ts` | noise | Same NTFS-has-no-POSIX-exec-bit limitation as the `linux-*` CLI shim/dispatcher tests above. |

## Tally

- 51 failing files classified: **18 signal, 33 noise** (33 includes the 3
  carried-verbatim pre-existing `session-scanner-*` files).
- Plus 1 addendum carried verbatim (not counted in the 51, since it's a
  typecheck-only finding, not a `vitest run` failure this run):
  `session-scanner-crush-cleanup.test.ts`'s "falls back to ps..." test.

## Pointer, not a line item (per this task's non-goals)

The OpenCode SQLite worker-factory-never-invoked issue noted during
`DEVX-012`'s review currently **passes** (masking a separate, unrelated bug),
so it is not one of the 147 failures and is out of this task's scope. Noted
here only as a pointer for whoever picks it up next.

## Hands-on evidence

Literal command used to produce the full-suite run this triage is based on
(already running before this task started; not re-run by this task):

```
pnpm exec vitest run --config config/vitest.config.ts --reporter=default --reporter=json --outputFile.json=<scratch>/devx-013-suite.json
```

Final state: no summary line was ever printed (process hung at teardown and
was killed after 12+ minutes frozen). Counts derived from per-file reporter
lines: **51 files failing / 3618 passing (3695 total)**, **147 tests failing**
(summed from each failing file's `(N failed)` annotation).

Each of the 51 files was then individually re-confirmed with:

```
tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts <path-to-test-file>
```

run from `apps/desktop/orca` with `npm_config_virtual_store_dir_max_length=30`
set, except `resolve-7za-path.test.mjs` (deliberately not re-run — see its
entry above).

## Handoff

This task classifies only; it does not fix any failure and does not open new
task specs. The human decides which signal findings above become tasks. The
most actionable next steps, in rough priority order: (1) fix or bound the
whole-suite hang (`resolve-7za-path.test.mjs`'s real toolset-download calls),
(2) fix the `node:path.join`-on-Windows cluster, starting with
`codex-session-resume-home.ts` (breaks real Codex resume) and
`worktree-base-directory-event-filter.ts` (breaks worktree file-watch
classification), (3) pin locale explicitly for the two locale-leak findings.
