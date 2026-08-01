import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const fixturesDir = path.join(repoRoot, 'tools', 'corpus-learning', 'fixtures')
const extractor = path.join(repoRoot, 'tools', 'corpus-learning', 'extract-candidates.mjs')
const missingDb = path.join(repoRoot, 'does-not-exist-for-test.db')

function runExtractor() {
  const result = spawnSync(process.execPath, ['--no-warnings', extractor], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      ...process.env,
      CORPUS_DIR: fixturesDir,
      DB_PATH: missingDb
    }
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

const r = runExtractor()

// Test 1: script runs without error, output parses
assert('run: exit 0 and JSON output',
  r.exitCode === 0 && r.output && !r.output.parseError,
  `exit=${r.exitCode} stderr=${r.stderr}`)

if (r.output && !r.output.parseError) {
  const { stats, candidates } = r.output

  // Test 2: all 5 fixtures read
  assert('run: reads all 5 fixture tasks',
    stats.totalTasks === 5,
    `totalTasks=${stats.totalTasks}`)

  // Test 3: no DB → zero sessions, offline-safe
  assert('run: offline without DB (sessions = 0)',
    stats.totalSessions === 0 && candidates.every((c) => c.sessions.length === 0),
    `totalSessions=${stats.totalSessions}`)

  // Test 4: read-only meta absent when no DB file exists
  assert('run: corpusFileUnchanged is null offline',
    r.output.meta.corpusFileUnchanged === null,
    `meta=${JSON.stringify(r.output.meta)}`)

  const fx1 = candidates.filter((c) => c.taskId === 'FX-001')
  // Test 5: FX-001 reviewer-finding bold markers captured
  assert('FX-001: emits candidates for B1 and M1',
    fx1.length === 4,
    `got ${fx1.length}`)
  const fx1b1 = fx1.find((c) => c.finding.marker === 'B1' && c.sourceType === 'reviewer-finding')
  assert('FX-001: B1 reviewer-finding carries BLOCKER severity',
    fx1b1 && fx1b1.finding.severity === 'BLOCKER',
    fx1b1 ? `severity=${fx1b1.finding.severity}` : 'not found')
  assert('FX-001: B1 finding text matches the reviewer parecer',
    fx1b1 && fx1b1.finding.text.includes('double-consume em string literals'),
    fx1b1 ? fx1b1.finding.text : 'not found')
  assert('FX-001: citation points to §8 parecer subsection',
    fx1b1 && fx1b1.citation.section.includes('Parecer do Agente Revisor'),
    fx1b1 ? fx1b1.citation.section : 'not found')
  assert('FX-001: citation carries a grep-able marker',
    fx1b1 && fx1b1.citation.grep === '\\[B1\\]',
    fx1b1 ? fx1b1.citation.grep : 'not found')

  // Test 6: FX-001 rework-correction bullets captured
  const fx1r = fx1.find((c) => c.sourceType === 'rework-correction')
  assert('FX-001: rework-correction bullet captured',
    fx1r && fx1r.reworkRound && fx1r.reworkRound.includes('Rework'),
    fx1r ? `rework=${fx1r.reworkRound}` : 'not found')

  // Test 7: FX-001 carries Objetivo
  const anyFx1 = fx1[0]
  assert('FX-001: payload carries §1 Objetivo',
    anyFx1 && anyFx1.objetivo && anyFx1.objetivo.includes('parsePrimary'),
    anyFx1 ? anyFx1.objetivo : 'no payload')

  const fx2 = candidates.filter((c) => c.taskId === 'FX-002')
  // Test 8: FX-002 rework bullets
  assert('FX-002: emits candidates for B1 and M2',
    fx2.length >= 3,
    `got ${fx2.length}`)
  const fx2m2 = fx2.find((c) => c.finding.marker === 'M2' && c.sourceType === 'rework-correction')
  assert('FX-002: M2 rework-correction text matches source',
    fx2m2 && fx2m2.finding.text.includes('asserção do E2E'),
    fx2m2 ? fx2m2.finding.text : 'not found')

  const fx3 = candidates.filter((c) => c.taskId === 'FX-003')
  // Test 9: FX-003 inline reference captured
  assert('FX-003: emits candidate for inline M1 reference',
    fx3.some((c) => c.finding.marker === 'M1' && c.sourceType === 'inline-reference'),
    `got ${fx3.length} candidates`)
  const fx3c = fx3.find((c) => c.sourceType === 'inline-reference')
  assert('FX-003: inline text contains the paragraph context',
    fx3c && fx3c.finding.text.includes('cache não é invalidado'),
    fx3c ? fx3c.finding.text : 'not found')

  // Test 10: FX-004 no findings
  const fx4 = candidates.filter((c) => c.taskId === 'FX-004')
  assert('FX-004: no candidates emitted',
    fx4.length === 0,
    `got ${fx4.length}`)

  // Test 11: FX-005 root marker dropped without citation
  const fx5 = candidates.filter((c) => c.taskId === 'FX-005')
  assert('FX-005: root marker dropped (no verifiable citation)',
    fx5.length === 0 && stats.candidatesDropped === 1 &&
    stats.dropReasons['missing-citation'] === 1,
    `fx5=${fx5.length} dropped=${stats.candidatesDropped} reasons=${JSON.stringify(stats.dropReasons)}`)

  // Test 12: every emitted candidate has a verifiable citation
  const allCited = candidates.every(
    (c) => c.citation && c.citation.file && c.citation.section && !c.citation.section.includes('root')
  )
  assert('run: every candidate has a citation',
    allCited,
    'some candidate missing citation')

  // Test 13: citation grep lands on the source (simulated offline)
  const citationFiles = new Set(candidates.map((c) => c.citation.file))
  const fixtureFiles = readdirSync(fixturesDir).filter((f) => f.endsWith('.md'))
  assert('run: cited files all exist in the corpus',
    [...citationFiles].every((f) => fixtureFiles.some((ff) => ff === path.basename(f))),
    [...citationFiles].join(','))
}

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} assertions`)

if (failures.length > 0) {
  console.error('\nFailures:')
  for (const f of failures) {
    console.error(`  ${f}`)
  }
  process.exit(1)
}
