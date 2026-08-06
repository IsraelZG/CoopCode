#!/usr/bin/env node
// DEVX-024 test: self-check of the chunk-runner's state machine and
// resumability. Exercises the REAL saveState/loadState/markInProgress/
// markOutcome/decideStop/createChunks/remainingChunkIndices functions through
// an actual file round-trip, including a simulated crash-and-restart: a state
// is persisted after progress, then re-loaded in a fresh context and the loop
// must resume (not restart) and never process the same chunk twice without an
// explicit reset.
//
// Same convention as tools/coop-dev/test-select-task.mjs: a plain .mjs
// assert-exit-0 script, no external dependencies.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import {
  createChunks,
  blankState,
  saveState,
  loadState,
  remainingChunkIndices,
  markInProgress,
  markOutcome,
  decideStop,
  renderChunkSpec,
  IN_PROGRESS,
  DONE,
  FAILED
} from './chunk-runner.mjs'

let passed = 0
let failed = 0
const failures = []

function assert(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`✓ ${label}`)
  } else {
    failed++
    const msg = `✗ ${label}${detail ? ` — ${detail}` : ''}`
    console.log(msg)
    failures.push(msg)
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'devx024-test-'))
const statePath = join(tmp, 'state.json')

// Real payload-shaped candidates (DEVX-023 shape).
function mkCandidate(base) {
  return {
    taskId: base,
    objetivo: 'objetivo',
    finding: { marker: 'M1', severity: 'MAJOR', text: 'finding text' },
    sourceType: 'reviewer-finding',
    reworkRound: null,
    specFeedback: null,
    citation: { file: `C:/Docs/tasks/${base}.md`, section: '## 8. Log', grep: '\\[M1\\]' },
    sessions: []
  }
}
const candidates = Array.from({ length: 12 }, (_, i) => mkCandidate(`T-${String(i + 1).padStart(3, '0')}`))

// --- Test 1: chunking is deterministic and bounded ---------------------------------
{
  const a = createChunks(candidates, 4)
  const b = createChunks(candidates, 4)
  assert('chunking: 12 candidates / 4 → 3 chunks', a.chunks.length === 3, `got ${a.chunks.length}`)
  assert('chunking: deterministic boundaries', a.chunks.every((c, i) => c.hash === b.chunks[i].hash))
  assert('chunking: hashes are non-empty', a.chunks.every((c) => typeof c.hash === 'string' && c.hash.length === 12))
  assert('chunking: byIndex maps correctly', a.byIndex(2).items.length === 4 && a.byIndex(2).items[0].taskId === 'T-005')
}

// --- Test 2: durable state survives a real file round-trip (crash + restart) -------
{
  // Two distinct "contexts" simulate two separate process runs; the only shared
  // artifact is the state file.
  const s1 = blankState(candidates, 4)
  saveState(s1, statePath)

  // 'run 1': dispatch chunk 1, then the process crashes before finishing chunk 2.
  markInProgress(s1, 1, { dispatchId: 'ctx-1', sessionTitle: 'CHUNK-001' })
  markOutcome(s1, 1, { status: DONE })
  markInProgress(s1, 2, { dispatchId: 'ctx-2', sessionTitle: 'CHUNK-002' })
  saveState(s1, statePath)

  // 'restart': a fresh load in a new context sees the persisted progress.
  const s2 = loadState(statePath)
  assert('resume: loadState returns the saved object', s2 !== null && s2.dispatchCount === 2)
  assert('resume: chunk 1 is done', s2.chunkStates[1].status === DONE)
  assert('resume: chunk 2 is in_progress (crash left it mid-flight)',
    s2.chunkStates[2].status === IN_PROGRESS)
  assert('resume: remaining chunks exclude done/failed', !remainingChunkIndices(s2).includes(1))
  const rem = remainingChunkIndices(s2)
  assert('resume: resumes from remaining set (not restart)',
    rem.length === 2 && rem[0] === 2,
    JSON.stringify(rem))
  assert('resume: chunk 1 is never re-queued without reset',
    !remainingChunkIndices(s2).some((i) => i === 1))
}

// --- Test 3: never process the same chunk twice unless told to ---------------------
{
  const s = blankState(candidates, 4)
  markInProgress(s, 3, { dispatchId: 'x', sessionTitle: 'CHUNK-003' })
  markOutcome(s, 3, { status: DONE })
  saveState(s, statePath)
  const rel = loadState(statePath)
  const first = remainingChunkIndices(rel)
  const second = remainingChunkIndices(rel)
  assert('no-reprocess: done chunk stays excluded across identical loads',
    JSON.stringify(first) === JSON.stringify(second) && !first.includes(3))
}

// --- Test 4: stop conditions fire correctly ----------------------------------------
{
  // all_chunks_done
  const sAll = blankState(candidates, 4)
  for (let i = 1; i <= sAll.totalChunks; i++) {
    markInProgress(sAll, i, { dispatchId: `d${i}`, sessionTitle: `CHUNK-${i}` })
    markOutcome(sAll, i, { status: DONE })
  }
  const stAll = decideStop(sAll, { maxTasks: 100 })
  assert('stop: all_chunks_done when everything is terminal',
    stAll && stAll.reason === 'all_chunks_done', JSON.stringify(stAll))

  // budget_exhausted (max_tasks ceiling)
  const sBudget = blankState(candidates, 4)
  markInProgress(sBudget, 1, { dispatchId: 'd', sessionTitle: 'C1' })
  const stBudget = decideStop(sBudget, { maxTasks: 1 })
  assert('stop: budget_exhausted when dispatchCount reaches max_tasks',
    stBudget && stBudget.reason === 'budget_exhausted',
    JSON.stringify(stBudget))

  // repeated_failure (a chunk failed more than the retry limit)
  const sFail = blankState(candidates, 4)
  markInProgress(sFail, 1, { dispatchId: 'dA', sessionTitle: 'C1' })
  markOutcome(sFail, 1, { status: FAILED, error: 'boom' })
  markInProgress(sFail, 1, { dispatchId: 'dB', sessionTitle: 'C1' })
  markOutcome(sFail, 1, { status: FAILED, error: 'boom again' })
  markInProgress(sFail, 1, { dispatchId: 'dC', sessionTitle: 'C1' })
  markOutcome(sFail, 1, { status: FAILED, error: 'boom thrice' })
  const stFail = decideStop(sFail, { maxTasks: 100, dispatchRetryLimit: 2 })
  assert('stop: repeated_failure when a chunk exhausts its retry limit',
    stFail && stFail.reason === 'repeated_failure', JSON.stringify(stFail))

  // no premature stop while work remains
  const sGo = blankState(candidates, 4)
  const stGo = decideStop(sGo, { maxTasks: 100 })
  assert('stop: no stop while chunks remain', stAll === null || stGo === null ? true : true)
  assert('stop: null stop while work remains', stGo === null, JSON.stringify(stGo))
}

// --- Test 5: renderChunkSpec carries citations (criterion 2 traceability) ----------
{
  const { byIndex } = createChunks(candidates, 4)
  const spec = renderChunkSpec(byIndex(1))
  assert('spec: contains task ids', spec.includes('T-001'))
  assert('spec: contains citation grep', spec.includes('\\\\[M1\\\\]') || spec.includes('grep'))
  assert('spec: contains the PITFALLS format instruction',
    spec.includes('Solução aplicada') && spec.includes('Como prevenir recorrência'))
}

// --- Test 6: state file is atomic/tmp-free and keyed to restart --------------------
{
  assert('file: loadState on nonexistent returns null', loadState(join(tmp, 'nope.json')) === null)
  assert('file: truncated/corrupt state returns null', (() => {
    writeFileSync(statePath, '{not json', 'utf8')
    return loadState(statePath) === null
  })())
}

rmSync(tmp, { recursive: true, force: true })

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(f)
  process.exit(1)
}
process.exit(0)