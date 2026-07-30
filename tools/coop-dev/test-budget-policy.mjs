import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixturesDir = path.join(repoRoot, 'docs', 'coop', 'fixtures', 'budget-policy-v1')
const validator = path.join(repoRoot, 'tools', 'coop-dev', 'validate-budget-policy.mjs')

function validate(filePath) {
  const result = spawnSync(process.execPath, [validator, filePath], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 10_000
  })
  return { exitCode: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() }
}

const entries = await readdir(fixturesDir)
const fixtures = entries.filter((name) => name.endsWith('.json')).sort()

if (fixtures.length === 0) {
  console.error('No fixtures found in', fixturesDir)
  process.exit(1)
}

let passed = 0
let failed = 0
const failures = []

for (const fixture of fixtures) {
  const filePath = path.join(fixturesDir, fixture)
  const shouldPass = fixture.startsWith('valid-')
  const result = validate(filePath)
  const actualPassed = result.exitCode === 0

  let status
  if (shouldPass && actualPassed) {
    status = 'PASS'
    passed++
  } else if (!shouldPass && !actualPassed) {
    status = 'PASS'
    passed++
  } else {
    status = 'FAIL'
    failed++
    failures.push({
      fixture,
      expected: shouldPass ? 'exit 0' : 'exit non-zero',
      got: `exit ${result.exitCode}`,
      stderr: result.stderr
    })
  }

  const marker = status === 'PASS' ? '\u2713' : '\u2717'
  console.log(`${marker} ${fixture} (expected ${shouldPass ? 'valid' : 'invalid'}, got exit ${result.exitCode})`)
}

console.log(`\n${passed} passed, ${failed} failed out of ${fixtures.length} fixtures`)

if (failures.length > 0) {
  console.error('\nFailures:')
  for (const f of failures) {
    console.error(`\n  ${f.fixture}: expected ${f.expected}, got ${f.got}`)
    if (f.stderr) console.error(`  stderr: ${f.stderr}`)
  }
  process.exit(1)
}
