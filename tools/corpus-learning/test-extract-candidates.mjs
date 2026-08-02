import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

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

// === DEVX-026 rework probes ===
//
// The reviewer of DEVX-023 attempt 1 found that opening crush.db.bak with
// `node:sqlite` `{ readOnly: true }` still creates a 32 KB `-shm` and a
// 0-byte `-wal` on the first connection (the corpus file is in WAL mode).
// The fix is to open via the SQLite URI `file:<path>?immutable=1`, which
// opens read-only AND refuses to create the WAL/SHM pair. These three
// probes pin the invariant in the source, prove the URI itself behaves
// the way the fix assumes, and run the real extractor end-to-end against
// a WAL DB to confirm the directory stays clean.

{
  // Source-code invariants. Read once, check five things in one pass so the
  // tests document what the rework actually changed instead of a long
  // comment string we have to keep in sync.
  const extractorSource = readFileSync(extractor, 'utf8')

  // The reviewer found the dead `s8` local on the line right after
  // `const section8Key = …` inside extractFindings. Both lines were
  // removed; the only remaining `const s8` is the *used* one in main()
  // (line ~330 in the integrated file) which we must not touch. Pin
  // the rework by checking the dead pair is gone AND the surviving
  // `const s8` still lives inside main().
  assert('rework: dead `section8Key` / `s8` pair in `extractFindings` is gone',
    !/const section8Key\b/.test(extractorSource) &&
      !/\bconst s8 = section8Key\b/.test(extractorSource),
    '`const section8Key` or its dependent `s8` still present')
  const survivingS8 = extractorSource.match(/\bconst s8 = sections\[k\][\s\S]*?\n\s*\}/)
  assert('rework: surviving `const s8 = sections[k]` in main() is preserved',
    Boolean(survivingS8),
    'the only remaining `const s8` is in main() and must stay')

  assert('rework: source opens the DB via a file:<path>?immutable=1 URI',
    extractorSource.includes('?immutable=1') &&
      extractorSource.includes('new DatabaseSync'),
    'expected `?immutable=1` flag in the DatabaseSync constructor call')
  assert('rework: source no longer passes a bare path to DatabaseSync',
    !/new DatabaseSync\(DB_PATH,\s*\{/.test(extractorSource),
    'bare DB_PATH passed; the readOnly flag alone creates -shm/-wal siblings')
  assert('rework: dead `basename` import is gone',
    !/\bbasename\b/.test(extractorSource),
    'basename still referenced in the source')
  assert('rework: buildCitation takes only (taskFile, finding)',
    /function buildCitation\(taskFile, finding\)/.test(extractorSource) &&
      !/function buildCitation\(taskFile, taskId, finding\)/.test(extractorSource),
    'buildCitation signature still has the unused taskId parameter')
}

{
  // Probe the URI itself: open a WAL DB the way the extractor does and
  // verify a) the row is readable and b) no -shm / -wal is created.
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'extractor-sibling-probe-'))
  const tmpDb = path.join(tmpDir, 'probe.db')
  let probeDb = null
  let row = null
  let siblingsAfter = []
  try {
    probeDb = new DatabaseSync(tmpDb, { open: true })
    probeDb.exec('PRAGMA journal_mode = WAL')
    probeDb.exec('CREATE TABLE t (n INTEGER)')
    probeDb.exec('INSERT INTO t VALUES (42)')
    probeDb.close()
    probeDb = null

    const dbUri = `file:${tmpDb}?immutable=1`
    probeDb = new DatabaseSync(dbUri, { open: true, readOnly: true })
    row = probeDb.prepare('SELECT n FROM t').get()
    probeDb.close()
    probeDb = null

    siblingsAfter = readdirSync(tmpDir).filter(
      (f) => f.endsWith('-shm') || f.endsWith('-wal'),
    )
  } finally {
    if (probeDb) {
      try { probeDb.close() } catch { /* already closed */ }
    }
    rmSync(tmpDir, { recursive: true, force: true })
  }

  assert('URI probe: opened WAL DB via file:<path>?immutable=1 and read a row',
    row && row.n === 42,
    `row=${JSON.stringify(row)}`)
  assert('URI probe: zero -shm and -wal siblings created in the DB directory',
    siblingsAfter.length === 0,
    `siblings=${siblingsAfter.join(',') || 'none'}`)
}

{
  // End-to-end: build a tiny corpus + WAL DB, point the extractor at it,
  // and prove the DB directory never gains -shm / -wal siblings.
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'extractor-e2e-'))
  const corpusDir = path.join(tmpRoot, 'tasks')
  const dbDir = path.join(tmpRoot, 'db')
  const dbPath = path.join(dbDir, 'e2e.db')
  mkdirSync(corpusDir, { recursive: true })
  mkdirSync(dbDir, { recursive: true })
  // Minimal corpus task with a single reviewer-finding marker.
  const taskPath = path.join(corpusDir, 'E2E-001.md')
  writeFileSync(taskPath, [
    '---',
    'id: E2E-001',
    '---',
    '',
    '## 1. Objetivo',
    '',
    'prove the extractor end-to-end with a real SQLite DB and zero siblings',
    '',
    '## 8. Log de Handover',
    '',
    '### Parecer do Agente Revisor',
    '',
    '**[B1] (BLOCKER) — sibling files must not appear next to the corpus DB**',
    '',
  ].join('\n'))

  let setupDb = null
  let exitCode = null
  let stdout = ''
  let stderr = ''
  let siblingsAfter = []
  try {
    setupDb = new DatabaseSync(dbPath, { open: true })
    setupDb.exec('PRAGMA journal_mode = WAL')
    // Schema mirrors the real crush.db: columns the extractor reads from
    // sessions when building the join index.
    setupDb.exec(`CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      parent_session_id TEXT,
      title TEXT,
      message_count INTEGER,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      cost REAL,
      updated_at INTEGER,
      created_at INTEGER,
      summary_message_id INTEGER,
      todos TEXT
    )`)
    setupDb.close()
    setupDb = null

    const result = spawnSync(process.execPath, ['--no-warnings', extractor], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...process.env,
        CORPUS_DIR: corpusDir,
        DB_PATH: dbPath,
      },
    })
    exitCode = result.status
    stdout = result.stdout || ''
    stderr = result.stderr || ''

    siblingsAfter = readdirSync(dbDir).filter(
      (f) => f.endsWith('-shm') || f.endsWith('-wal'),
    )
  } finally {
    if (setupDb) {
      try { setupDb.close() } catch { /* already closed */ }
    }
    rmSync(tmpRoot, { recursive: true, force: true })
  }

  assert('e2e: extractor exit 0 against a real WAL DB',
    exitCode === 0,
    `exit=${exitCode} stderr=${stderr.slice(0, 200)}`)
  const hasE2E = stdout.includes('"taskId": "E2E-001"') ||
    stdout.includes('"taskId":"E2E-001"')
  assert('e2e: emitted the expected E2E-001 candidate',
    hasE2E,
    `stdout first 200 chars: ${stdout.slice(0, 200)}`)
  assert('e2e: zero -shm and -wal siblings next to the corpus DB',
    siblingsAfter.length === 0,
    `siblings=${siblingsAfter.join(',') || 'none'}`)
}

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} assertions`)

if (failures.length > 0) {
  console.error('\nFailures:')
  for (const f of failures) {
    console.error(`  ${f}`)
  }
  process.exit(1)
}
