import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

// Self-check for extract-tool-usage-stats.mjs against small fixture databases
// (never the real 757 MB corpus). Same pattern as test-extract-candidates.mjs:
// spawn the extractor with env pointers to the fixtures, assert on its JSON.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const extractor = path.join(repoRoot, 'tools', 'corpus-learning', 'extract-tool-usage-stats.mjs')

function createFixtureDb(dir, name, { bigBranch = false } = {}) {
  const dbPath = path.join(dir, name)
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      message_count INTEGER,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      created_at INTEGER
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      parts TEXT NOT NULL DEFAULT '[]',
      model TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      finished_at INTEGER,
      provider TEXT,
      is_summary_message INTEGER NOT NULL DEFAULT 0
    );
  `)
  db.prepare("INSERT INTO sessions (id, title, message_count, prompt_tokens, completion_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run('s1', 'FX session', 3, 100, 200, 1)

  function tool(id, name, content, isError = false) {
    const part = { type: 'tool_result', data: { tool_call_id: `call_${id}`, name, content, is_error: isError } }
    db.prepare("INSERT INTO messages (id, session_id, role, parts, created_at, updated_at) VALUES (?, 's1', 'tool', ?, 1, 1)")
      .run(id, JSON.stringify([part, { type: 'finish', data: { reason: 'stop', time: 0 } }]))
  }
  function assistantCall(id, name, command) {
    const part = { type: 'tool_call', data: { id: `call_${id}`, name, input: JSON.stringify({ command, description: 'fx' }), finished: true } }
    db.prepare("INSERT INTO messages (id, session_id, role, parts, created_at, updated_at) VALUES (?, 's1', 'assistant', ?, 1, 1)")
      .run(id, JSON.stringify([part]))
  }

  tool('m1', 'bash', 'hello')
  tool('m2', 'bash', 'hello world again')
  tool('m3', 'bash', 'boom', true)
  tool('m4', 'edit', 'file X has been modified since it was last read', true)
  tool('m5', 'edit', 'old_string not found in file. Make sure it matches exactly, including whitespace', true)
  tool('m6', 'edit', 'applied cleanly')
  tool('m7', 'view', 'short')
  tool('m8', 'view', 'a'.repeat(400))
  tool('m9', 'lsp_diagnostics', 'no issues')
  tool('m10', 'mcp_headroom_headroom_retrieve', 'x'.repeat(100))
  if (bigBranch) {
    const branches = []
    for (let i = 0; i < 60; i++) {
      branches.push({ name: `task/T-${String(i).padStart(3, '0')}`, commitHash: 'dc1d1a62993b43dfd08dde25e616309a6c2b280c', current: false, ahead: 0, behind: 0 })
    }
    tool('m11', 'mcp_git_git_branch', JSON.stringify({ success: true, mode: 'list', branches }, null, 2))
  } else {
    tool('m11', 'mcp_git_git_branch', '{"success":true,"mode":"create","message":"created"}')
  }
  tool('m12', 'Edit', 'orphan-like name')
  tool('m13', 'globl', 'orphan-like name')
  tool('m14', 'edit', 'you must read the file before editing it. Use the View tool first', true)
  tool('m15', 'edit', 'new content is the same as old content. No changes made.', true)

  assistantCall('a1', 'bash', 'git status --short')
  assistantCall('a2', 'bash', 'ls some/dir')
  assistantCall('a3', 'bash', 'cd C:/tmp')
  assistantCall('a4', 'bash', 'node tools/scripts/manage-task.mjs start T-1 X')
  assistantCall('a5', 'bash', 'cat config.json')
  assistantCall('a6', 'bash', 'pnpm --filter x build')
  assistantCall('a7', 'bash', 'grep -r "foo" src/')
  assistantCall('a8', 'bash', 'git -C "C:/Dev2026/Docs" add tasks/T-001.md && git -C "C:/Dev2026/Docs" commit -m "chore"')
  db.close()
  return dbPath
}

function runExtractor(bakPath, livePath) {
  const result = spawnSync(process.execPath, ['--no-warnings', extractor], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      BAK_DB_PATH: bakPath,
      LIVE_DB_PATH: livePath
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

const dir = mkdtempSync(path.join(tmpdir(), 'fx-tool-usage-'))
const bakPath = createFixtureDb(dir, 'fx-bak.db', { bigBranch: true })
const livePath = createFixtureDb(dir, 'fx-live.db', { bigBranch: false })
const missingPath = path.join(dir, 'does-not-exist.db')

try {
  const r = runExtractor(bakPath, livePath)

  assert('run: exit 0 and JSON output',
    r.exitCode === 0 && r.output && !r.output.parseError,
    `exit=${r.exitCode} stderr=${r.stderr}`)

  if (r.output && !r.output.parseError) {
    const { bak, live, meta } = r.output

    // Test 1: corpus of record fully read
    assert('bak: toolMessages match fixture (15 tool rows)',
      bak.toolMessages === 15,
      `toolMessages=${bak.toolMessages}`)
    assert('bak: sessions read',
      bak.sessions === 1,
      `sessions=${bak.sessions}`)

    // Test 2: per-tool aggregates (calls, errors, errorRate)
    const bash = bak.tools.find((t) => t.name === 'bash')
    assert('bak: bash calls=3 errors=1 rate=0.333',
      bash && bash.calls === 3 && bash.errors === 1 && bash.errorRate === 0.333,
      JSON.stringify(bash))
    const edit = bak.tools.find((t) => t.name === 'edit')
    assert('bak: edit calls=5 errors=4 rate=0.8 (one clean edit)',
      edit && edit.calls === 5 && edit.errors === 4 && edit.errorRate === 0.8,
      JSON.stringify(edit))

    // Test 3: content-size metrics (avg/median/max)
    const view = bak.tools.find((t) => t.name === 'view')
    assert('bak: view avgChars=(5+400)/2=203 median=203 max=400',
      view && view.avgChars === 203 && view.medianChars === 203 && view.maxChars === 400,
      JSON.stringify(view))
    const gb = bak.tools.find((t) => t.name === 'mcp_git_git_branch')
    assert('bak: git_branch payload size > 1000 with 60 branches',
      gb && gb.totalChars > 1000 && gb.maxChars > 1000,
      `totalChars=${gb && gb.totalChars}`)

    // Test 4: edit error buckets classified with citations
    assert('bak: editErrors buckets cover all 4 fixture reasons (total=4)',
      bak.editErrors && bak.editErrors.total === 4 &&
        bak.editErrors.buckets['stale-read-guard'] === 1 &&
        bak.editErrors.buckets['old-string-not-found'] === 1 &&
        bak.editErrors.buckets['edit-without-read'] === 1 &&
        bak.editErrors.buckets['no-op-edit'] === 1,
      JSON.stringify(bak.editErrors && bak.editErrors.buckets))
    assert('bak: edit error examples carry messageId + sessionId',
      bak.editErrors && bak.editErrors.examples['stale-read-guard']?.[0]?.messageId === 'm4',
      JSON.stringify(bak.editErrors && bak.editErrors.examples['stale-read-guard']))

    // Test 5: MCP/LSP family breakdown
    assert('bak: mcpByServer has git and headroom, separate',
      bak.mcpByServer.some((s) => s.server === 'git' && s.calls === 1) &&
        bak.mcpByServer.some((s) => s.server === 'headroom' && s.calls === 1),
      JSON.stringify(bak.mcpByServer))
    assert('bak: lsp family includes lsp_diagnostics',
      bak.families.lsp.calls === 1 && bak.families.lsp.toolCount === 1,
      JSON.stringify(bak.families.lsp))
    assert('bak: native family holds bash/view/edit',
      bak.families.native.toolCount >= 3 && bak.families.native.calls >= 7,
      JSON.stringify(bak.families.native))

    // Test 6: bash command classification
    assert('bak: bashCommands total=8 with git/file-read/cd/build buckets',
      bak.bashCommands && bak.bashCommands.total === 8 &&
        bak.bashCommands.buckets['git-vcs'] === 2 &&
        bak.bashCommands.buckets['file-read'] === 3 &&
        bak.bashCommands.buckets['cd-navigation'] === 1 &&
        bak.bashCommands.buckets['build-tooling'] === 2,
      JSON.stringify(bak.bashCommands && bak.bashCommands.buckets))

    // Test 7: data-quality aside (malformed names counted, not merged into tools)
    assert('bak: malformed names Edit/globl flagged as data quality',
      bak.dataQuality.malformedNames.Edit === 1 && bak.dataQuality.malformedNames.globl === 1,
      JSON.stringify(bak.dataQuality.malformedNames))

    // Test 8: read-only guarantee holds on the fixture
    assert('bak: corpusFileUnchanged=true (size+mtime identical)',
      bak.corpusFileUnchanged === true && meta.bakFileUnchanged === true,
      `bak=${bak.corpusFileUnchanged} meta=${meta.bakFileUnchanged}`)

    // Test 9: live corpus kept separate, not merged
    assert('live: separate section with its own counts',
      live && typeof live === 'object' && live.toolMessages === 15 &&
        live.tools.some((t) => t.name === 'bash' && t.calls === 3) &&
        live.totalChars !== bak.totalChars,
      `live.toolMessages=${live && live.toolMessages} liveChars=${live && live.totalChars} bakChars=${bak.totalChars}`)
    assert('live: deep dives not computed for the live corpus',
      live && live.editErrors === undefined && live.bashCommands === undefined,
      'live should not carry deep-dive sections')

    // Test 10: offline-safe — missing DB path is reported, not a crash
    const offline = runExtractor(missingPath, missingPath)
    assert('offline: exit 0 with bak.unavailable=true',
      offline.exitCode === 0 && offline.output && offline.output.bak && offline.output.bak.unavailable === true,
      `exit=${offline.exitCode}`)
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} assertions`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error('\nFailures:')
  for (const f of failures) {
    console.error(`  ${f}`)
  }
  process.exit(1)
}
