#!/usr/bin/env node
// DEVX-024 chunk-runner: grinds the DEVX-023 candidates through real
// `orca orchestration task-create` + `worker-start --agent opencode`
// dispatches, keeping durable resumable state so an interrupted run resumes
// instead of restarting. Every chunk goes through the real dispatch path —
// there is no `direct-*` execution branch and no other agent type.
//
// Usage:
//   node tools/corpus-learning/chunk-runner.mjs [--chunks <N>] [--chunk-size <K>]
//       [--candidates <path|:extract>] [--state <path>] [--log <path>]
//       [--cli <cli-entry.js>] [--worktree <selector>] [--dry-run] [--reset]
//
// The runner is split into two layers so the state machine and resumability are
// testable offline (test-chunk-runner.mjs drives the real saveState/loadState
// functions through an actual file round-trip):
//   - the pure/state-machine layer (createChunks, saveState, loadState,
//     markInProgress, markOutcome, decideStop) with no I/O beyond the state file;
//   - the dispatch layer (dispatchChunk) that shells out to the real orca CLI.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// ---------------------------------------------------------------------------
// Chunking (pure)
// ---------------------------------------------------------------------------

// Group candidate payloads into stable chunks keyed by a 1-based index plus a
// content hash. Chunks are derived deterministically from the candidate list so
// a re-run after a crash reproduces the same chunk boundaries.
export function createChunks(candidates, chunkSize = 4) {
  const chunks = []
  for (let i = 0; i < candidates.length; i += chunkSize) {
    const items = candidates.slice(i, i + chunkSize)
    const digest = createHash('sha256')
      .update(items.map((c) => JSON.stringify(c)).join('\n'))
      .digest('hex')
      .slice(0, 12)
    chunks.push({
      index: Math.floor(i / chunkSize) + 1,
      size: items.length,
      hash: digest,
      startIndex: i,
      items
    })
  }
  return { chunks, byIndex: (idx) => chunks[Number(idx) - 1] }
}

// ---------------------------------------------------------------------------
// Durable resumable state
// ---------------------------------------------------------------------------

const IDLE = 'idle'
const PENDING = 'pending'
const IN_PROGRESS = 'in_progress'
const DONE = 'done'
const FAILED = 'failed'

export function blankState(candidates, chunkSize) {
  const { chunks } = createChunks(candidates, chunkSize)
  return {
    version: 1,
    runId: null,
    createdAt: new Date().toISOString(),
    chunkSize,
    totalChunks: chunks.length,
    dispatchCount: 0,
    processedCount: 0,
    stopReason: null,
    stopDetail: null,
    chunkStates: Object.fromEntries(
      chunks.map((c) => [c.index, { status: IDLE, attempts: 0, dispatchId: null, sessionTitle: null, error: null }])
    )
  }
}

export function saveState(state, filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp`
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8')
  rmSync(filePath, { force: true })
  writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8')
  try { rmSync(tmp, { force: true }) } catch { /* best effort */ }
  return true
}

export function loadState(filePath) {
  if (!existsSync(filePath)) return null
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
    if (parsed.version !== 1 || !parsed.chunkStates) return null
    return parsed
  } catch {
    return null
  }
}

// Chunk indices still needing work (never returns a done/failed index unless
// the state was explicitly reset — that is what guarantees a chunk is not
// processed twice without being told to).
export function remainingChunkIndices(state) {
  const out = []
  for (const idx of Object.keys(state.chunkStates)) {
    const cs = state.chunkStates[idx]
    if (cs.status === DONE || cs.status === FAILED) continue
    out.push(Number(idx))
  }
  return out
}

export function markInProgress(state, index, { dispatchId, sessionTitle }) {
  const cs = state.chunkStates[index]
  if (!cs) throw new Error(`no chunk index ${index}`)
  cs.status = IN_PROGRESS
  cs.dispatchId = dispatchId
  cs.sessionTitle = sessionTitle
  cs.attempts = (cs.attempts || 0) + 1
  state.dispatchCount++
  return state
}

export function markOutcome(state, index, { status, error = null }) {
  const cs = state.chunkStates[index]
  if (!cs) throw new Error(`no chunk index ${index}`)
  cs.status = status
  cs.error = error
  if (status === DONE || status === FAILED) state.processedCount = (state.processedCount || 0) + 1
  return state
}

export function outcomeIsDone(status) { return status === DONE }
export function outcomeIsFailed(status) { return status === FAILED }

// ---------------------------------------------------------------------------
// Stop-condition decision (pure; mirrors development-budget-v1.json)
// ---------------------------------------------------------------------------

export function decideStop(state, { maxTasks = Infinity, dispatchRetryLimit = 2, attempted } = {}) {
  const remaining = remainingChunkIndices(state)
  if (remaining.length === 0) return { reason: 'all_chunks_done' }

  // Budget ceiling on dispatch attempts is honored (successful or failed) —
  // silence must never be indistinguishable from progress.
  const attempts = attempted ?? state.dispatchCount
  if (attempts >= maxTasks) {
    return { reason: 'budget_exhausted', detail: `max_tasks=${maxTasks} reached (${attempts} dispatches)` }
  }

  // A genuinely-failed chunk that exceeds the retry limit is a stop.
  for (const idx of Object.keys(state.chunkStates)) {
    const cs = state.chunkStates[idx]
    if (cs.status !== FAILED) continue
    if (cs.attempts >= dispatchRetryLimit) {
      return {
        reason: 'repeated_failure',
        detail: `chunk ${idx} failed ${cs.attempts} time(s); last error: ${cs.error ?? 'unknown'}`
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Dispatch layer (real `orca orchestration task-create` + worker-start)
// ---------------------------------------------------------------------------

export function resolveCliInvocation(opt = {}) {
  if (opt.cli) return [process.execPath, opt.cli]
  const envCmd = process.env.ORCA_CLI_COMMAND
  if (envCmd) return [envCmd]
  const candidates = [
    path.join('C:', 'Dev2026', 'builds', 'coopcode', 'current', 'resources', 'app.asar.unpacked', 'out', 'cli', 'index.js')
  ]
  for (const c of candidates) {
    if (existsSync(c)) return [process.execPath, c]
  }
  return ['orca']
}

export function buildDispatchCommands(cliInvocation, chunk, repoWorktree, senderTerminal) {
  const chunkLabel = `CHUNK-${String(chunk.index).padStart(3, '0')}`
  const spec = renderChunkSpec(chunk)
  const runIdArg = process.env.ORCA_RUN_ID ? ['--run', process.env.ORCA_RUN_ID] : []
  // The packaged/orca CLI rejects creation flags (--display-name, --comment,
  // --repo, --base-branch, --setup) for existing worktrees, and `worker-start`
  // requires a bound sender terminal. The stable CHUNK-NNN label comes from
  // task-create's --task-title; the opencode session inherits that task label.
  return {
    chunkLabel,
    create: {
      argv: [
        'orchestration', 'task-create',
        '--spec', spec,
        '--task-title', chunkLabel,
        '--display-name', `${chunkLabel} (DEVX-024)`,
        '--json',
        ...runIdArg
      ]
    },
    start: {
      argv: [
        'orchestration', 'worker-start',
        '--task', '__TASK_ID_PLACEHOLDER__',
        '--agent', 'opencode',
        ...(senderTerminal ? ['--from', senderTerminal] : []),
        '--json',
        ...runIdArg
      ]
    }
  }
}

export function renderChunkSpec(chunk) {
  const items = chunk.items
    .map((c) => `- task ${c.taskId}\n  finding [${c.finding.marker}] (${c.finding.severity}):\n    ${c.finding.text}\n  source: ${c.citation.file} :: ${c.citation.section}\n  grep: ${c.citation.grep}`)
    .join('\n')
  return `# CHUNK-${String(chunk.index).padStart(3, '0')}\n\nAnalyze these corpus-learning candidates and produce candidate rules shaped to the PITFALLS.md format (## P-NNN · Título, **Data:**, **Sintoma:**, **Causa raiz:**, **Solução aplicada:**, **Evidência:**, **Como prevenir recorrência:**, **Limites:**). Do not modify any files; respond with the candidate rules.\n\n${items}`
}

export function runOrca(cliInvocation, argv, opts = {}) {
  const res = spawnSync(cliInvocation[0], [...(cliInvocation.slice(1)), ...argv], {
    cwd: opts.cwd || REPO_ROOT,
    encoding: 'utf8',
    timeout: opts.timeout || 90_000,
    shell: false
  })
  const stdout = (res.stdout || '').trim()
  let parsed = null
  try { parsed = stdout ? JSON.parse(stdout) : null } catch { parsed = null }
  return { exitCode: res.status, stdout, stderr: (res.stderr || '').trim(), json: parsed }
}

export function dispatchChunk(chunk, ctx) {
  const { cliInvocation, repoWorktree } = ctx
  const commands = buildDispatchCommands(cliInvocation, chunk, repoWorktree)
  const label = commands.chunkLabel

  const createRes = runOrca(cliInvocation, commands.create.argv)
  const createOk = createRes.json && createRes.json.result && createRes.json.result.task
  const taskId = createOk ? createRes.json.result.task.id : null
  const senderTerminal = createOk ? createRes.json.result.task.created_by_terminal_handle : null
  if (createRes.exitCode !== 0 || !taskId) {
    return {
      status: FAILED,
      dispatchId: null,
      error: `task-create failed (exit ${createRes.exitCode}): ${(createRes.stderr || createRes.stdout).slice(0, 200)}`
    }
  }

  const startArgv = buildDispatchCommands(cliInvocation, chunk, repoWorktree, senderTerminal)
    .start.argv.map((a) => (a === '__TASK_ID_PLACEHOLDER__' ? taskId : a))
  const startRes = runOrca(cliInvocation, startArgv)
  const start = startRes.json && startRes.json.result
  const dispatchId = start && start.dispatchId ? start.dispatchId : null

  if (startRes.exitCode !== 0 || !dispatchId) {
    return {
      status: FAILED,
      dispatchId: null,
      taskId,
      error: `worker-start failed (exit ${startRes.exitCode}): ${(startRes.stderr || startRes.stdout).slice(0, 200)}`
    }
  }

  const sessionTitle =
    (start && start.dispatch && start.dispatch.id) ||
    dispatchId ||
    label
  return {
    status: IN_PROGRESS,
    dispatchId,
    sessionTitle,
    taskId,
    state: start && start.state ? start.state : null
  }
}

// ---------------------------------------------------------------------------
// Loop log writer
// ---------------------------------------------------------------------------

export function renderLoopLogHeader(state) {
  return [
    `# DEVX-024 loop log`,
    ``,
    `Run: ${state.runId ?? 'unset'}`,
    `Started: ${state.createdAt}`,
    `Chunks total: ${state.totalChunks}`,
    `Chunk size: ${state.chunkSize}`,
    ``,
    `Status: ${state.stopReason ? `stopped (${state.stopReason})` : 'running'}`,
    `Dispatches: ${state.dispatchCount}`,
    `Processed (done/failed): ${state.processedCount}`,
    ``
  ].join('\n')
}

export function renderChunkLogLines(chunk, cs) {
  const end = cs.finishedAt ? new Date(cs.finishedAt).toISOString() : '-'
  const duration = cs.startedAt && cs.finishedAt
    ? `${Math.round((new Date(cs.finishedAt) - new Date(cs.startedAt)) / 1000)}s`
    : '-'
  return [
    `## ${chunk ? `CHUNK-${String(chunk.index).padStart(3, '0')}` : '?'}`,
    `- dispatchId: ${cs.dispatchId ?? '-'}`,
    `- session title: ${cs.sessionTitle ?? '-'}`,
    `- start: ${cs.startedAt ? new Date(cs.startedAt).toISOString() : '-'}`,
    `- end: ${end}`,
    `- duration: ${duration}`,
    `- outcome: ${cs.status}`,
    `- candidate rules: ${cs.candidateRules ?? 'n/a (see dispatch session output)'}`,
    `- error: ${cs.error ?? '-'}`,
    ``
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const o = { chunks: Infinity, chunkSize: 4, dryRun: false, reset: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--chunks') o.chunks = Number(argv[++i])
    else if (a === '--chunk-size') o.chunkSize = Number(argv[++i])
    else if (a === '--candidates') o.candidates = argv[++i]
    else if (a === '--state') o.state = argv[++i]
    else if (a === '--log') o.log = argv[++i]
    else if (a === '--cli') o.cli = argv[++i]
    else if (a === '--worktree') o.worktree = argv[++i]
    else if (a === '--dry-run') o.dryRun = true
    else if (a === '--reset') o.reset = true
    else if (a === '--dispatch-retry-limit') o.dispatchRetryLimit = Number(argv[++i])
  }
  return o
}

export function loadCandidates(opt) {
  if (opt.candidates && opt.candidates !== ':extract') {
    const doc = JSON.parse(readFileSync(opt.candidates, 'utf8'))
    return (doc.candidates || doc).filter((c) => c && c.taskId)
  }
  const extractor = path.join(REPO_ROOT, 'tools', 'corpus-learning', 'extract-candidates.mjs')
  const res = runOrca([process.execPath], [extractor], { timeout: 300_000 })
  if (res.exitCode !== 0 || !res.stdout) {
    throw new Error(`could not extract candidates (exit ${res.exitCode})`)
  }
  return JSON.parse(res.stdout).candidates || []
}

export function writeLogFromState(statePath, logPath, candidates) {
  const state = loadState(statePath)
  if (!state) throw new Error('no state to log')
  const { byIndex } = createChunks(candidates || [], state.chunkSize)
  let out = renderLoopLogHeader(state)
  for (const idx of Object.keys(state.chunkStates)) {
    const cs = state.chunkStates[idx]
    const chunk = byIndex(Number(idx))
    out += renderChunkLogLines(chunk, cs) + '\n'
  }
  if (state.stopDetail) out += `\nStop detail: ${state.stopDetail}\n`
  mkdirSync(path.dirname(logPath), { recursive: true })
  writeFileSync(logPath, out, 'utf8')
}

async function main(argv = process.argv.slice(2)) {
  const opt = parseArgs(argv)
  const statePath = opt.state || path.join(REPO_ROOT, 'tools', 'corpus-learning', '.devx024', 'state.json')
  const logPath = opt.log || process.env.CHUNK_RUNNER_LOG || path.join(REPO_ROOT, 'docs', 'planning', 'evidence', 'DEVX-024-loop-log.md')

  const candidates = loadCandidates(opt)

  let state = opt.reset ? null : loadState(statePath)
  if (!state) {
    state = blankState(candidates, opt.chunkSize)
    state.runId = `devx024-${createHash('sha1').update(new Date().toISOString()).digest('hex').slice(0, 10)}`
    saveState(state, statePath)
  }

  const { byIndex } = createChunks(candidates, state.chunkSize)
  const dispatchRetryLimit = opt.dispatchRetryLimit ?? 2
  const maxTasks = Number.isFinite(opt.chunks) ? opt.chunks : state.totalChunks

  const cliInvocation = opt.dryRun ? null : resolveCliInvocation({ cli: opt.cli })

  let cursor = 0
  let attemptCount = 0
  while (true) {
    // Budget ceiling counts every dispatch *attempt* (successful or failed), so
    // a run capped at `--chunks N` stops after N attempts regardless of outcome.
    const stop = decideStop(state, { maxTasks, dispatchRetryLimit, attempted: attemptCount })
    if (stop) {
      state.stopReason = stop.reason
      if (stop.detail) state.stopDetail = stop.detail
      break
    }

    // Pick the next non-terminal chunk strictly after the cursor so a single
    // run always targets a *distinct* chunk (never re-election of the chunk we
    // just dispatched). In-progress chunks from an interrupted run are only
    // re-dispatched when they are the earliest remaining work — preserving
    // resumability without double-processing a completed chunk.
    const indices = remainingChunkIndices(state).sort((a, b) => a - b)
    const next = indices.find((i) => i > cursor) ?? indices[0]
    if (next === undefined) {
      state.stopReason = 'all_chunks_done'
      break
    }
    cursor = next

    // Count this chunk visit as a dispatch attempt (dry-run or real). Done once
    // per loop so `--chunks N` caps the number of chunks touched, regardless of
    // whether the dispatch succeeds, fails, or is a dry run.
    attemptCount++

    const chunk = byIndex(next)
    const cs = state.chunkStates[next]

    if (opt.dryRun) {
      const commands = buildDispatchCommands(['orca'], chunk, opt.worktree || 'current')
      console.log(`DRY RUN → dispatch ${commands.chunkLabel} (${chunk.items.length} candidates, hash ${chunk.hash})`)
      console.log(commands.create.argv.join(' '))
      console.log(commands.start.argv.join(' ').replace('__TASK_ID_PLACEHOLDER__', '<task-id>'))
      markInProgress(state, next, { dispatchId: `${chunk.hash}-dry`, sessionTitle: commands.chunkLabel })
      saveState(state, statePath)
      continue
    }

    cs.startedAt = new Date().toISOString()
    saveState(state, statePath)
    const outcome = dispatchChunk(chunk, {
      cliInvocation,
      repoWorktree: opt.worktree || 'current',
      taskLabelNote: `CHUNK-${String(next).padStart(3, '0')}`
    })

    if (outcome.status === FAILED) {
      markOutcome(state, next, { status: FAILED, error: outcome.error })
      cs.finishedAt = new Date().toISOString()
      cs.error = outcome.error
      if (outcome.taskId) cs.taskId = outcome.taskId
      saveState(state, statePath)
      continue
    }

    markInProgress(state, next, { dispatchId: outcome.dispatchId, sessionTitle: outcome.sessionTitle })
    if (outcome.taskId) cs.taskId = outcome.taskId
    cs.finishedAt = new Date().toISOString()
    cs.outcomeState = outcome.state || null
    saveState(state, statePath)
  }

  saveState(state, statePath)
  writeLogFromState(statePath, logPath, candidates)
  console.log(JSON.stringify(
    { runId: state.runId, stopReason: state.stopReason, stopDetail: state.stopDetail ?? null, dispatchCount: state.dispatchCount, processedCount: state.processedCount, totalChunks: state.totalChunks },
    null, 2))
}

export { IDLE, PENDING, IN_PROGRESS, DONE, FAILED }

// Only run the CLI loop when executed directly, never on import (the test
// imports these functions).
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(new URL(import.meta.url))
if (isMain) {
  main().then(() => process.exit(0)).catch((err) => {
    console.error(err && err.message ? err.message : String(err))
    process.exit(1)
  })
}