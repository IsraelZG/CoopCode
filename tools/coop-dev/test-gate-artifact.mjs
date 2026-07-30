import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const validatorPath = path.resolve(repoRoot, 'tools', 'coop-dev', 'validate-gate-artifact.mjs')
const fixturesDir = path.resolve(repoRoot, 'docs', 'coop', 'fixtures', 'gate-artifact-v1')

function run(artifact, extraArgs = []) {
  const args = [validatorPath, artifact, ...extraArgs]
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' })
  return {
    exitCode: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  }
}

const failures = []
let passed = 0
let total = 0

function check(label, artifact, expectValid, extraArgs = []) {
  total++
  const result = run(artifact, extraArgs)
  const isValid = result.exitCode === 0

  if (isValid === expectValid) {
    passed++
    return
  }

  failures.push({
    label,
    expected: expectValid ? 'valid' : 'invalid',
    got: isValid ? 'valid' : 'invalid',
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr
  })
}

const validComplete = path.join(fixturesDir, 'valid-complete.json')
const invalidSha = path.join(fixturesDir, 'invalid-malformed-sha.json')
const invalidCommand = path.join(fixturesDir, 'invalid-incomplete-command.json')
const invalidCriterion = path.join(fixturesDir, 'invalid-missing-criterion.json')
const invalidResultSha = path.join(fixturesDir, 'invalid-result-sha-mismatch.json')

const expectedSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

check('valid-complete', validComplete, true, [`--result-sha=${expectedSha}`])
check('invalid-malformed-sha', invalidSha, false)
check('invalid-incomplete-command', invalidCommand, false)
check('invalid-missing-criterion', invalidCriterion, false)
check('invalid-result-sha-mismatch', invalidResultSha, false, ['--result-sha=cccccccccccccccccccccccccccccccccccccccc'])

console.log(`${passed}/${total} fixtures passed`)

if (failures.length > 0) {
  for (const f of failures) {
    console.error(`\nFAIL: ${f.label}`)
    console.error(`  Expected ${f.expected}, got ${f.got}`)
    console.error(`  exitCode: ${f.exitCode}`)
    if (f.stdout) console.error(`  stdout: ${f.stdout}`)
    if (f.stderr) console.error(`  stderr: ${f.stderr}`)
  }
  process.exit(1)
}

console.log('All fixtures passed.')
