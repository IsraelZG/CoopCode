import { spawnSync } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixturesDir = path.join(repoRoot, 'docs', 'coop', 'fixtures', 'task-selection-v1')
const selector = path.join(repoRoot, 'tools', 'coop-dev', 'select-task.mjs')

function runSelector(extraArgs = [], taskList = []) {
  const taskPaths = taskList.map((name) => path.join(fixturesDir, name))
  const result = spawnSync(process.execPath, [selector, ...extraArgs, ...taskPaths], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 10_000
  })
  let output = null
  try {
    output = JSON.parse(result.stdout.trim())
  } catch {
    output = { raw: result.stdout.trim(), parseError: true }
  }
  return { exitCode: result.status, output, stderr: result.stderr.trim() }
}

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

// Test 1: Priority ordering — P0 should be selected over P1
{
  const r = runSelector([], ['ready-p0.md', 'ready-p1.md'])
  assert('priority: P0 selected over P1',
    r.exitCode === 0 && r.output.selected === 'SEL-P0',
    `got selected=${r.output.selected}`)
  assert('priority: P1 excluded as lower priority',
    r.output.excluded && r.output.excluded.some((e) => e.id === 'SEL-P1' && e.reason.includes('lower priority')),
    `P1 should be excluded with reason about lower priority`)
}

// Test 2: Tie-breaking — SEL-P1 should be selected over SEL-P1B (lexicographic ID)
{
  const r = runSelector([], ['ready-p1.md', 'ready-p1-b.md'])
  assert('tiebreak: SEL-P1 selected over SEL-P1B',
    r.exitCode === 0 && r.output.selected === 'SEL-P1',
    `got selected=${r.output.selected}`)
}

// Test 3: Tie-breaking is order-independent
{
  const r = runSelector([], ['ready-p1-b.md', 'ready-p1.md'])
  assert('tiebreak: order-independent (SEL-P1 over SEL-P1B)',
    r.exitCode === 0 && r.output.selected === 'SEL-P1',
    `got selected=${r.output.selected}`)
}

// Test 4: Dependency blocking — SEL-DEP excluded without SOME-DEP done
{
  const r = runSelector([], ['ready-p0.md', 'ready-with-dep.md'])
  assert('dep: SEL-DEP excluded when SOME-DEP not done',
    r.exitCode === 0 && r.output.selected === 'SEL-P0' &&
    r.output.excluded.some((e) => e.id === 'SEL-DEP' && e.reason.includes('missing dependency')),
    `got selected=${r.output.selected}, excluded=${JSON.stringify(r.output.excluded)}`)
}

// Test 5: Dependency satisfied — SEL-DEP eligible with SOME-DEP done
{
  const r = runSelector(['--done', 'SOME-DEP'], ['ready-p1.md', 'ready-with-dep.md'])
  assert('dep: SEL-DEP eligible when SOME-DEP is done',
    r.exitCode === 0 && r.output.selected === 'SEL-DEP',
    `got selected=${r.output.selected}`)
}

// Test 6: Blocked on external — SEL-BLOCKED excluded
{
  const r = runSelector([], ['ready-p0.md', 'ready-blocked.md'])
  assert('blocked: SEL-BLOCKED excluded',
    r.exitCode === 0 && r.output.selected === 'SEL-P0' &&
    r.output.excluded.some((e) => e.id === 'SEL-BLOCKED' && e.reason.includes('blocked on')),
    `got selected=${r.output.selected}, excluded=${JSON.stringify(r.output.excluded)}`)
}

// Test 7: Capability missing — SEL-CAP excluded without gpu-access
{
  const r = runSelector(['--capabilities', 'repository-read,repository-write'], ['ready-p0.md', 'ready-needs-cap.md'])
  assert('cap: SEL-CAP excluded without gpu-access',
    r.exitCode === 0 && r.output.selected === 'SEL-P0' &&
    r.output.excluded.some((e) => e.id === 'SEL-CAP' && e.reason.includes('missing capability')),
    `got selected=${r.output.selected}`)
}

// Test 8: Capability satisfied — SEL-CAP eligible with gpu-access
{
  const r = runSelector(
    ['--capabilities', 'repository-read,repository-write,gpu-access'],
    ['ready-p1.md', 'ready-needs-cap.md']
  )
  assert('cap: SEL-CAP eligible with gpu-access',
    r.exitCode === 0 && r.output.selected === 'SEL-CAP',
    `got selected=${r.output.selected}`)
}

// Test 9: Non-ready states — all excluded
const nonReadyStates = [
  { file: 'draft.md', state: 'draft' },
  { file: 'working.md', state: 'working' },
  { file: 'review.md', state: 'review' },
  { file: 'done-task.md', state: 'done' }
]
for (const { file, state } of nonReadyStates) {
  const r = runSelector([], [file])
  assert(`state: ${state} excluded`,
    r.exitCode === 0 && r.output.selected === null &&
    r.output.excluded.some((e) => e.reason.includes(`state is '${state}'`)),
    `got selected=${r.output.selected}, excluded=${JSON.stringify(r.output.excluded)}`)
}

// Test 10: No tasks provided
{
  const r = runSelector([], [])
  assert('empty: no tasks → selected null',
    r.exitCode === 0 && r.output.selected === null && r.output.reason === 'no tasks provided',
    `got ${JSON.stringify(r.output)}`)
}

// Test 11: All excluded — selected null
{
  const r = runSelector([], ['draft.md', 'working.md', 'review.md', 'done-task.md'])
  assert('all-excluded: selected null, all have reasons',
    r.exitCode === 0 && r.output.selected === null &&
    r.output.excluded.length === 4 &&
    r.output.reason === 'no eligible task found',
    `got ${JSON.stringify(r.output)}`)
}

// Test 12: Multiple exclusion reasons
{
  const r = runSelector([], ['ready-p0.md', 'ready-blocked.md', 'draft.md', 'ready-with-dep.md'])
  assert('multi-exclude: correct count',
    r.exitCode === 0 && r.output.selected === 'SEL-P0' && r.output.excluded.length === 3,
    `got selected=${r.output.selected}, excluded count=${r.output.excluded?.length}`)
}

// Test 13: Single eligible task
{
  const r = runSelector([], ['ready-p0.md'])
  assert('single: only task selected',
    r.exitCode === 0 && r.output.selected === 'SEL-P0',
    `got selected=${r.output.selected}`)
}

// Test 14: Priority ordering — P0, P1, P4
{
  const r = runSelector([], ['ready-p1.md', 'ready-p0.md'])
  assert('priority: P0 selected regardless of input order',
    r.exitCode === 0 && r.output.selected === 'SEL-P0',
    `got selected=${r.output.selected}`)
}

// Test 15: Default capabilities include repository-read and repository-write
{
  const r = runSelector([], ['ready-p0.md'])
  assert('default caps: task with no capabilities is eligible',
    r.exitCode === 0 && r.output.selected === 'SEL-P0',
    `got selected=${r.output.selected}`)
}

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} assertions`)

if (failures.length > 0) {
  console.error('\nFailures:')
  for (const f of failures) {
    console.error(`  ${f}`)
  }
  process.exit(1)
}
