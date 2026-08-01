import { spawnSync } from 'node:child_process'
import { readFile, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const runner = resolve(repoRoot, 'tools', 'coop-dev', 'run-full-suite-detached.mjs')
const tmpDir = resolve(repoRoot, 'logs', 'test-run-full-suite-detached-tmp')

function runDetached(commandArgs) {
  const result = spawnSync(process.execPath, [runner, ...commandArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 15_000
  })
  let output = null
  try {
    output = JSON.parse(result.stdout.trim())
  } catch {
    output = { raw: result.stdout.trim(), parseError: true }
  }
  return { exitCode: result.status, output, stderr: result.stderr.trim() }
}

async function pollMarker(markerFile, timeoutMs = 10_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const raw = await readFile(markerFile, 'utf8')
      // Marker with exitCode means completed
      if (raw.includes('"exitCode"')) {
        return JSON.parse(raw)
      }
    } catch {
      // File may not exist yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return null
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

async function runTests() {
  await mkdir(tmpDir, { recursive: true })

  const markerFile = resolve(tmpDir, 'test-detached.marker')
  const logFile = resolve(tmpDir, 'test-detached.log')
  const fakeCmd = process.platform === 'win32' ? 'cmd' : 'sh'
  const fakeArgs = process.platform === 'win32'
    ? ['/c', 'echo hello-detached-test && echo marker-test > NUL && exit 0']
    : ['-c', 'echo hello-detached-test && exit 0']

  // Clean up from previous runs
  try { await rm(markerFile, { force: true }) } catch {}
  try { await rm(logFile, { force: true }) } catch {}

  // Test 1: Missing command exits with error
  {
    const r = runDetached(['--cwd', repoRoot])
    assert('missing-command: exits with error',
      r.exitCode !== 0,
      `got exitCode=${r.exitCode}, stderr=${r.stderr}`)
  }

  // Test 2: Starts with valid command, writes started marker immediately
  {
    const r = runDetached([
      '--cwd', repoRoot,
      '--marker', markerFile,
      '--log', logFile,
      '--', fakeCmd, ...fakeArgs
    ])
    assert('start: exits 0 and returns JSON',
      r.exitCode === 0 && r.output.status === 'detached',
      `got exitCode=${r.exitCode}, output=${JSON.stringify(r.output)}`)

    assert('start: outputs pid',
      typeof r.output.pid === 'number' && r.output.pid > 0,
      `got pid=${r.output.pid}`)

    // Check a marker was written (started or already completed for fast commands)
    const markerRaw = JSON.parse(await readFile(markerFile, 'utf8'))
    assert('start: writes marker (started or completed)',
      (markerRaw.status === 'started' || markerRaw.status === 'completed'),
      `got marker=${JSON.stringify(markerRaw)}`)
  }

  // Test 3: Child completes and writes completion marker
  {
    const completed = await pollMarker(markerFile, 10_000)
    assert('complete: writes completion marker with exitCode',
      completed !== null && completed.status === 'completed' && typeof completed.exitCode === 'number',
      `got completed=${JSON.stringify(completed)}`)

    // Only check exit code if completed
    if (completed) {
      assert('complete: child exit code 0',
        completed.exitCode === 0,
        `got exitCode=${completed.exitCode}`)
    }
  }

  // Test 4: Log file contains output
  {
    const logContent = await readFile(logFile, 'utf8')
    assert('log: captures child output',
      logContent.includes('hello-detached-test'),
      `got log content (${logContent.length} chars): ${logContent.slice(0, 200)}`)
  }

  // Test 5: Argument handling with explicit separator
  {
    const m2 = resolve(tmpDir, 'test-detached-2.marker')
    const l2 = resolve(tmpDir, 'test-detached-2.log')
    try { await rm(m2, { force: true }) } catch {}
    try { await rm(l2, { force: true }) } catch {}

    const r = runDetached([
      '--log', l2,
      '--marker', m2,
      '--cwd', repoRoot,
      '--', fakeCmd,
      ...fakeArgs
    ])
    assert('args: custom log and marker accepted',
      r.exitCode === 0,
      `got exitCode=${r.exitCode}, stderr=${r.stderr}`)

    const m2Completed = await pollMarker(m2, 10_000)
    assert('args: custom marker written on completion',
      m2Completed !== null && m2Completed.status === 'completed',
      `got marker=${JSON.stringify(m2Completed)}`)

    try { await rm(m2, { force: true }) } catch {}
    try { await rm(l2, { force: true }) } catch {}
  }

  // Cleanup
  try { await rm(tmpDir, { recursive: true, force: true }) } catch {}

  console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} assertions`)

  if (failures.length > 0) {
    console.error('\nFailures:')
    for (const f of failures) {
      console.error(`  ${f}`)
    }
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error(err)
  process.exit(1)
})
