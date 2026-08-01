import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const dispatcher = path.join(repoRoot, 'tools', 'coop-dev', 'dispatch-task.mjs')
const fixtureTask = 'docs/coop/fixtures/task-selection-v1/ready-p0.md'

function runDispatch(extraArgs = []) {
  const result = spawnSync(process.execPath, [dispatcher, ...extraArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000
  })
  return {
    exitCode: result.status ?? null,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  }
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

// Test 1: Missing task argument → exit code 2, usage message
{
  const r = runDispatch([])
  assert('args: missing task arg exits 2',
    r.exitCode === 2,
    `got exitCode=${r.exitCode}`)
  assert('args: usage message on stderr',
    r.stderr.includes('Usage:'),
    `got stderr="${r.stderr.slice(0, 80)}"`)
}

// Test 2: Invalid agent → exit code 2, error message listing valid agents
{
  const r = runDispatch(['--agent=nonexistent', fixtureTask])
  assert('agent: invalid agent exits 2',
    r.exitCode === 2,
    `got exitCode=${r.exitCode}`)
  assert('agent: error mentions "Invalid agent"',
    r.stderr.includes('Invalid agent'),
    `got stderr="${r.stderr.slice(0, 80)}"`)
  assert('agent: error lists crush as valid option',
    r.stderr.includes('crush'),
    `got stderr="${r.stderr.slice(0, 120)}"`)
}

// Test 3: Default agent is "crush" — dry-run output should mention crush
{
  const r = runDispatch(['--dry-run', fixtureTask])
  assert('default-agent: dry-run succeeds',
    r.exitCode === 0,
    `got exitCode=${r.exitCode}, stderr="${r.stderr.slice(0, 200)}"`)
  assert('default-agent: dry-run output names crush as agent',
    r.stdout.includes('--agent crush'),
    `got stdout="${r.stdout.slice(0, 300)}"`)
}

// Test 4: Explicit agent override — dry-run output should use the specified agent
{
  const r = runDispatch(['--dry-run', '--agent=codex', fixtureTask])
  assert('explicit-agent: dry-run with codex succeeds',
    r.exitCode === 0,
    `got exitCode=${r.exitCode}, stderr="${r.stderr.slice(0, 200)}"`)
  assert('explicit-agent: dry-run output names codex as agent',
    r.stdout.includes('--agent codex'),
    `got stdout="${r.stdout.slice(0, 300)}"`)
}

// Test 5: Dry-run output contains task-create command structure
{
  const r = runDispatch(['--dry-run', fixtureTask])
  assert('command: dry-run includes task-create',
    r.stdout.includes('task-create'),
    `got stdout="${r.stdout.slice(0, 300)}"`)
  assert('command: dry-run includes worker-start',
    r.stdout.includes('worker-start'),
    `got stdout="${r.stdout.slice(0, 300)}"`)
  assert('command: dry-run includes --spec flag',
    r.stdout.includes('--spec'),
    `got stdout="${r.stdout.slice(0, 300)}"`)
  assert('command: dry-run includes --task-title flag',
    r.stdout.includes('--task-title'),
    `got stdout="${r.stdout.slice(0, 300)}"`)
  assert('command: dry-run includes --display-name flag',
    r.stdout.includes('--display-name'),
    `got stdout="${r.stdout.slice(0, 300)}"`)
}

// Test 6: Dry-run output carries task ID and title in display name
{
  const r = runDispatch(['--dry-run', fixtureTask])
  assert('display-name: contains task ID SEL-P0',
    r.stdout.includes('SEL-P0'),
    `got stdout="${r.stdout.slice(0, 300)}"`)
  assert('display-name: display-name format is "ID: Title"',
    r.stdout.includes('SEL-P0: Fixture') || r.stdout.includes('SEL-P0:'),
    `got stdout="${r.stdout.slice(0, 300)}"`)
}

// Test 7: Dry-run output includes worktree path
{
  const r = runDispatch(['--dry-run', fixtureTask])
  assert('worktree: dry-run output includes worktree path',
    r.stdout.includes('--worktree'),
    `got stdout="${r.stdout.slice(0, 300)}"`)
}

// Test 8: Dry-run output includes the preamble (comment)
{
  const r = runDispatch(['--dry-run', fixtureTask])
  assert('preamble: dry-run output includes comment/preamble',
    r.stdout.includes('comment:') || r.stdout.includes('--comment'),
    `got stdout="${r.stdout.slice(0, 500)}"`)
  assert('preamble: comment mentions coop-worker',
    r.stdout.includes('coop-worker'),
    `got stdout="${r.stdout.slice(0, 500)}"`)
}

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} assertions`)

if (failures.length > 0) {
  console.error('\nFailures:')
  for (const f of failures) {
    console.error(`  ${f}`)
  }
  process.exit(1)
}
