---
{
  "id": "DEVX-049",
  "title": "Live-verify DEVX-044's opencode headless dispatch end to end: real worker-start call and a real restricted agent profile from opencode agent create",
  "state": "ready",
  "lane": "standard",
  "priority": "P1",
  "risk": "high",
  "depends_on": ["DEVX-044"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/providers/opencode-headless-dispatch.ts",
    "apps/desktop/orca/src/main/providers/opencode-headless-dispatch.test.ts",
    "apps/desktop/orca/config/electron-builder.config.cjs",
    "docs/planning/evidence/DEVX-049-gate.json"
  ]},
  "profiles": {"worker": "high", "reviewer": "high"},
  "budget": {"wall_minutes": 150, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-049.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-049-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/providers/opencode-headless-dispatch.test.ts",
      "purpose": "Confirm no regression to the existing unit suite, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-049 · Prove opencode headless dispatch works against a real running app, not only mocks

## Outcome

`DEVX-044` (headless `opencode serve` + `run --attach` dispatch for
`worker-start --agent opencode`) was integrated on a human decision despite
its own review disclosing that criteria 2-4 — the serve/health-retry loop,
the actual `run --attach` dispatch, and restricted agent profile creation —
were only unit-tested with mocks, never verified against a real running app
that contains this code, because the only reachable packaged build at the
time predated the change. A packaged build now exists that does contain
DEVX-044's code (see `docs/planning/evidence/DEVX-044-gate.json`'s baseline
note and the build produced 2026-08-05), removing the original blocker. This
task performs the live verification the original attempt could not, and
closes the specific correctness risk the review flagged in
`openCodeAgentFileMatchesPermissions`: that its strict "every non-requested
permission must be explicitly denied" check was written against `--help`
text and a hand-authored test fixture, never against real
`opencode agent create` output.

## Acceptance

- [ ] A real `orca orchestration worker-start --agent opencode` call (via
      the CLI, against a running CoopCode instance built from current
      `main`) starts or reuses a headless `opencode serve` for a real
      worktree and completes without ever touching the TUI path. Capture the
      actual command(s) run and their output as evidence.
- [ ] `GET /session` on that server shows a real session whose title matches
      the dispatch id, and the dispatched work is genuinely visible in it —
      not merely that the RPC call returned success.
- [ ] A real `opencode agent create --path <dir> --mode subagent
      --permissions <csv>` invocation is run and its generated file is
      captured. `openCodeAgentFileMatchesPermissions` is checked against
      that real file's actual frontmatter shape, not only the existing
      hand-authored test fixture. If the real shape differs from what the
      function assumes (e.g. omits non-granted keys instead of writing
      explicit `deny` lines, or formats the `permission:` block differently
      than the two regex shapes the function currently handles), fix the
      function to match reality and add a regression test built from the
      real captured output — do not leave a known mismatch undocumented.
- [ ] A caller requesting a restricted, read-mostly profile
      (`read,glob,grep`, no `bash`/`webfetch`) through this real path
      actually gets an agent that can't invoke the denied tools — not just
      that profile creation succeeded. Demonstrate this with a real
      dispatched session attempting a denied action and being refused.
- [ ] The existing 22-test unit suite in
      `opencode-headless-dispatch.test.ts` still passes unmodified in spirit
      (adjusted only if the fix above requires it) — this task adds live
      verification, it does not remove or weaken existing coverage.

## Non-goals

- Do not change `worker-start`'s wiring in `orchestration-workers.ts`, the
  CLI handler/spec, the RPC schema, or `preload`/`shared` types — those are
  `DEVX-044`'s own scope and are already integrated and working per this
  task's own verification. This task is about proving and, if needed,
  correcting `opencode-headless-dispatch.ts`'s internal assumptions, not
  re-opening its integration surface.
- Do not address the MINOR concurrency-race finding from `DEVX-044`'s review
  (no lock around the same-worktree serve start-or-reuse sequence) — that is
  a separate, lower-likelihood, lower-priority follow-up if it ever manifests
  in practice, not part of this task.
- Do not build a permanent CI job that re-runs this live verification on
  every change. This is a one-time closure of a specific disclosed gap, not
  a new standing test infrastructure requirement.

## Sources and decisions

- `docs/coop/tasks/DEVX-044.md`'s `## Review (attempt 1)` section — the two
  MAJOR findings this task closes, verbatim: unverified live dispatch
  (criteria 2-4), and the untested-against-real-CLI-output permission
  verification.
- `docs/coop/tasks/DEVX-044.md`'s `## Human decision (2026-08-05)` section —
  records the decision to integrate anyway and track this gap here.
- `apps/desktop/orca/src/main/providers/opencode-headless-dispatch.ts`:
  `openCodeAgentFileMatchesPermissions` (~line 512) and
  `parseOpenCodeAgentFrontmatter` (~line 476) — the specific functions whose
  correctness against real CLI output this task must confirm or fix.
- Decided 2026-08-05: this task exists instead of reopening `DEVX-044` for a
  second attempt, since `DEVX-044` is already integrated and its own scope
  (the `worker-start` wiring) is not in question — only the two specific,
  narrower correctness assumptions inside `opencode-headless-dispatch.ts`
  are.

## Plan and test mapping

1. Confirm a packaged or dev-mode CoopCode instance is running code that
   includes `DEVX-044`'s integration (post `74e55ff71`). Criterion 1's
   precondition.
2. Run a real `worker-start --agent opencode` dispatch against a real
   worktree; capture `GET /session` evidence. Criteria 1 and 2.
3. Run a real `opencode agent create --mode subagent --permissions <csv>`
   and capture its output file verbatim; compare against
   `openCodeAgentFileMatchesPermissions`'s assumptions; fix and add a
   regression test if they diverge. Criterion 3.
4. Dispatch a session through that real restricted profile and demonstrate a
   denied tool is actually refused. Criterion 4.
5. Re-run the full existing unit suite to confirm no regression. Criterion 5.
6. Run the declared gates and write `docs/planning/evidence/DEVX-049-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Success is
`DEVX-044`'s three riskiest claims backed by something that actually ran, not
only by a mock that agreed with its own assumptions.

## Dispatcher note (2026-08-06) — real root cause found, scope widened

Live verification hit criterion 1's precondition head-on: every real
`worker-start --agent opencode` dispatch in this environment fails
(`runtime_unavailable` / "The Orca runtime closed the connection before
responding"). Traced the actual cause via `$APPDATA/orca/logs/daemon.log`
and one of its churning `terminal-history/*/output.log` entries:

```
opencode:
Line |
 102 |  opencode
     |  ~~~~~~~~
     | The term 'opencode' is not recognized as a name of a cmdlet, function,
       script file, or executable program.
```

`opencode-headless-dispatch.ts` spawns the binary by bare name
(`args.binary ?? 'opencode'`, see `spawnOpenCodeServe` ~line 273 and the
`run --attach` spawn ~line 95), relying on `opencode` being resolvable on
whatever PATH the Orca main process/daemon inherited. On this machine no
`opencode(.exe)` is anywhere on PATH — the only real binary is vendored at
`C:\Dev2026\external_repos\opencode\packages\opencode\dist\opencode-windows-arm64\bin\opencode.exe`,
copied ad hoc into `builds/coopcode/current/opencode/opencode.exe` by
`tools/build-coopcode.ps1` as a packaging afterthought, never wired into
`electron-builder.config.cjs`. This is why criteria 1-4 could never actually
run: the dispatch fails before a session, a serve, or an agent-create call
ever happens.

Direction, per direct instruction: CoopCode ships as a closed package —
opencode bundled with it, not a separate install the user must have on
PATH. Do not fix this by telling the user to add opencode to PATH. Fix it
so the app never depends on PATH for it, matching the pattern this repo
already uses for its other bundled native binaries:

1. **Runtime resolution** — in `opencode-headless-dispatch.ts`, replace the
   bare-name default with a resolver that checks the packaged location
   first, falling back to PATH only in dev/unpackaged runs. Copy the exact
   shape of `resolveAgentBrowserBinary()` in
   `apps/desktop/orca/src/main/browser/agent-browser-bridge.ts:180-198`
   (`process.resourcesPath` ?? platform-specific `app.getPath('exe')`
   fallback, `existsSync` check, then a dev-mode fallback path) — that
   function already solves this exact problem for another bundled binary
   (`agent-browser`) in this same codebase. The dev-mode fallback should
   check the vendored path
   `external_repos/opencode/packages/opencode/dist/opencode-<platform>-<arch>/bin/opencode(.exe)`
   relative to the repo root (mirroring what `build-coopcode.ps1:27` already
   assumes) before falling back to a bare `'opencode'` PATH lookup, so local
   dev runs without a packaged build still work.
2. **Packaging** — add `opencode` as a per-platform `extraResources` entry in
   `electron-builder.config.cjs`, same list `bin/orca.exe` and
   `agent-browser-win32-${arch}.exe` already live in for `win32` (~line 246),
   with equivalent entries for `darwin`/`linux` if a vendored binary exists
   for those platforms under `external_repos/opencode/packages/opencode/dist/`
   — if it does not yet exist for a platform, say so plainly in the report
   rather than silently skipping it.
3. Re-run criteria 1-4 against a real dispatch with the fix in place. If the
   fix resolves the connection failure, capture that as this task's primary
   evidence — it is at least as important as the two correctness findings
   the task was originally scoped for.

Preserve what attempt 1 already produced and left uncommitted: the new test
in `opencode-headless-dispatch.test.ts` locking in a real
`opencode agent create` output shape, and
`.scratch/devx049-live/worktree/.opencode/agents/dx-auditor.md` (the real
captured agent file that test is built from) — both are genuine partial
progress on criterion 3, not to be discarded.
