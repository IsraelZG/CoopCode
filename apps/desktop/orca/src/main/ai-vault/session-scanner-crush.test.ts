import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import Database from '../sqlite/sync-database'
import { buildCrushSqliteCandidatePath } from './session-scanner-crush-paths'
import { listCrushSqliteSessions } from './session-scanner-crush-list'
import { crushDiscoveries } from './session-scanner-crush-discovery'
import { parseCrushSession } from './session-scanner-crush-parser'
import type { AiVaultScanIssue } from '../../shared/ai-vault-types'

let tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs = []
})

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orca-crush-'))
  tempDirs.push(dir)
  return dir
}

function createTempDb(): { db: Database.Database; path: string } {
  const dir = createTempDir()
  const path = join(dir, 'crush.db')
  return { db: new Database(path), path }
}

function applyCrushSchema(db: Database.Database, versionId?: number): void {
  db.exec(`
    CREATE TABLE goose_db_version (
      id INTEGER PRIMARY KEY,
      version_id INTEGER NOT NULL,
      is_applied INTEGER NOT NULL DEFAULT 1,
      tstamp DATETIME DEFAULT NULL
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      parent_session_id TEXT,
      title TEXT,
      message_count INTEGER DEFAULT 0,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      summary_message_id TEXT,
      todos TEXT
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      parts TEXT NOT NULL DEFAULT '[]',
      model TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finished_at TEXT,
      provider TEXT,
      is_summary_message INTEGER DEFAULT 0
    );
  `)
  if (versionId !== undefined) {
    db.prepare(
      `INSERT INTO goose_db_version (version_id, is_applied, tstamp)
       VALUES (?, 1, datetime('now'))`
    ).run(versionId)
  }
}

function insertSession(
  db: Database.Database,
  args: {
    id: string
    title?: string
    messageCount?: number
    promptTokens?: number
    completionTokens?: number
    updatedAt?: string
    createdAt?: string
    parentSessionId?: string | null
  }
): void {
  db.prepare(
    `INSERT INTO sessions (id, parent_session_id, title, message_count,
       prompt_tokens, completion_tokens, updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    args.id,
    args.parentSessionId ?? null,
    args.title ?? null,
    args.messageCount ?? 0,
    args.promptTokens ?? 0,
    args.completionTokens ?? 0,
    args.updatedAt ?? new Date().toISOString(),
    args.createdAt ?? new Date().toISOString()
  )
}

function insertMessage(
  db: Database.Database,
  args: {
    id: string
    sessionId: string
    role: string
    parts: string
    createdAt?: string
  }
): void {
  db.prepare(
    `INSERT INTO messages (id, session_id, role, parts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(args.id, args.sessionId, args.role, args.parts, args.createdAt ?? new Date().toISOString(), args.createdAt ?? new Date().toISOString())
}

function hashFile(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex')
}

function hashFiles(paths: string[]): Record<string, string> {
  const hashes: Record<string, string> = {}
  for (const filePath of paths) {
    if (existsSync(filePath)) {
      hashes[filePath] = hashFile(filePath)
    }
  }
  return hashes
}

// Criterion 2: Session listing from crush.db
describe('listCrushSqliteSessions', () => {
  it('lists sessions sorted by updated_at desc', async () => {
    const { db, path } = createTempDb()
    applyCrushSchema(db, 20260127000000)
    insertSession(db, {
      id: 'ses_old',
      title: 'Old Session',
      updatedAt: '2026-07-29T10:00:00.000Z',
      createdAt: '2026-07-29T09:00:00.000Z'
    })
    insertSession(db, {
      id: 'ses_new',
      title: 'New Session',
      updatedAt: '2026-07-29T12:00:00.000Z',
      createdAt: '2026-07-29T11:00:00.000Z'
    })
    db.close()

    const issues: AiVaultScanIssue[] = []
    const candidates = await listCrushSqliteSessions({ dbPaths: [path], limit: 10, issues })
    expect(issues).toEqual([])
    expect(candidates).toHaveLength(2)
    expect(candidates[0].agent).toBe('crush')
    expect(candidates[0].file.mtimeMs).toBe(Date.parse('2026-07-29T12:00:00.000Z'))
    expect(candidates[0].file.path).toBe(buildCrushSqliteCandidatePath(path, 'ses_new'))
    expect(candidates[1].file.path).toBe(buildCrushSqliteCandidatePath(path, 'ses_old'))
  })

  it('filters out child sessions (with parent_session_id)', async () => {
    const { db, path } = createTempDb()
    applyCrushSchema(db, 20260127000000)
    insertSession(db, {
      id: 'ses_parent',
      title: 'Parent',
      updatedAt: '2026-07-29T10:00:00.000Z',
      createdAt: '2026-07-29T09:00:00.000Z'
    })
    insertSession(db, {
      id: 'ses_child',
      title: 'Child',
      parentSessionId: 'ses_parent',
      updatedAt: '2026-07-29T11:00:00.000Z',
      createdAt: '2026-07-29T10:00:00.000Z'
    })
    db.close()

    const issues: AiVaultScanIssue[] = []
    const candidates = await listCrushSqliteSessions({ dbPaths: [path], limit: 10, issues })
    expect(candidates).toHaveLength(1)
    expect(candidates[0].file.path).toBe(buildCrushSqliteCandidatePath(path, 'ses_parent'))
  })

  it('dedups matching session ids across databases', async () => {
    const { db: db1, path: path1 } = createTempDb()
    applyCrushSchema(db1, 20260127000000)
    insertSession(db1, {
      id: 'ses_dup',
      title: 'Old',
      updatedAt: '2026-07-29T10:00:00.000Z',
      createdAt: '2026-07-29T09:00:00.000Z'
    })
    db1.close()

    const { db: db2, path: path2 } = createTempDb()
    applyCrushSchema(db2, 20260127000000)
    insertSession(db2, {
      id: 'ses_dup',
      title: 'New',
      updatedAt: '2026-07-29T12:00:00.000Z',
      createdAt: '2026-07-29T11:00:00.000Z'
    })
    db2.close()

    const candidates = await listCrushSqliteSessions({
      dbPaths: [path1, path2],
      limit: 10,
      issues: []
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0].file.path).toBe(buildCrushSqliteCandidatePath(path2, 'ses_dup'))
  })

  it('returns [] when sessions table is missing', async () => {
    const { db, path } = createTempDb()
    db.exec('CREATE TABLE other (id TEXT)')
    db.close()

    const candidates = await listCrushSqliteSessions({
      dbPaths: [path],
      limit: 10,
      issues: []
    })
    expect(candidates).toEqual([])
  })
})

// Criterion 5: Version mismatch produces AiVaultScanIssue
describe('version check', () => {
  it('produces AiVaultScanIssue when version does not match 20260127000000', async () => {
    const { db, path } = createTempDb()
    applyCrushSchema(db, 99999999999999)
    insertSession(db, {
      id: 'ses_1',
      title: 'Some Session',
      updatedAt: '2026-07-29T10:00:00.000Z',
      createdAt: '2026-07-29T09:00:00.000Z'
    })
    db.close()

    const issues: AiVaultScanIssue[] = []
    const candidates = await listCrushSqliteSessions({ dbPaths: [path], limit: 10, issues })
    expect(candidates).toEqual([])
    expect(issues).toHaveLength(1)
    expect(issues[0].agent).toBe('crush')
    expect(issues[0].path).toBe(path)
    expect(issues[0].message).toContain('Unsupported crush.db version')
    expect(issues[0].message).toContain('99999999999999')
    expect(issues[0].message).toContain('20260127000000')
  })
})

// Criterion 3: Parser reads sessions + messages, discriminates by parts type
describe('parseCrushSession', () => {
  it('builds an AiVaultSession with title, timestamps, tokens, and message count', async () => {
    const { db, path } = createTempDb()
    applyCrushSchema(db, 20260127000000)
    insertSession(db, {
      id: 'ses_1',
      title: 'Fix the login bug',
      messageCount: 5,
      promptTokens: 1200,
      completionTokens: 800,
      updatedAt: '2026-07-29T12:00:00.000Z',
      createdAt: '2026-07-29T10:00:00.000Z'
    })
    db.close()

    const session = await parseCrushSession({
      dbPath: path,
      sessionId: 'ses_1',
      platform: 'win32'
    })
    expect(session).not.toBeNull()
    expect(session!.agent).toBe('crush')
    expect(session!.sessionId).toBe('ses_1')
    expect(session!.filePath).toBe(path)
    expect(session!.title).toBe('Fix the login bug')
    expect(session!.messageCount).toBe(5)
    expect(session!.totalTokens).toBe(2000)
    expect(session!.createdAt).toBe('2026-07-29T10:00:00.000Z')
    expect(session!.updatedAt).toBe('2026-07-29T12:00:00.000Z')
  })

  it('reads preview messages from messages.parts by type discriminator', async () => {
    const { db, path } = createTempDb()
    applyCrushSchema(db, 20260127000000)
    insertSession(db, {
      id: 'ses_preview',
      title: 'Preview test',
      messageCount: 3,
      updatedAt: '2026-07-29T12:00:00.000Z',
      createdAt: '2026-07-29T10:00:00.000Z'
    })
    insertMessage(db, {
      id: 'msg_1',
      sessionId: 'ses_preview',
      role: 'user',
      parts: JSON.stringify([
        { type: 'text', data: { text: 'What is the capital of France?' } }
      ]),
      createdAt: '2026-07-29T10:01:00.000Z'
    })
    insertMessage(db, {
      id: 'msg_2',
      sessionId: 'ses_preview',
      role: 'assistant',
      parts: JSON.stringify([
        { type: 'reasoning', data: { thinking: 'The capital of France is Paris.' } },
        { type: 'text', data: { text: 'The capital of France is Paris.' } }
      ]),
      createdAt: '2026-07-29T10:02:00.000Z'
    })
    insertMessage(db, {
      id: 'msg_3',
      sessionId: 'ses_preview',
      role: 'user',
      parts: JSON.stringify([
        { type: 'text', data: { text: 'What about Germany?' } }
      ]),
      createdAt: '2026-07-29T10:03:00.000Z'
    })
    db.close()

    const session = await parseCrushSession({
      dbPath: path,
      sessionId: 'ses_preview',
      platform: 'win32'
    })
    expect(session).not.toBeNull()
    expect(session!.previewMessages.length).toBeGreaterThan(0)
    expect(session!.previewMessages.some((m) => m.text.includes('capital of France'))).toBe(true)
    expect(session!.previewMessages.some((m) => m.text.includes('Germany'))).toBe(true)
    expect(session!.previewMessages.every((m) => m.role === 'user' || m.role === 'assistant')).toBe(
      true
    )
  })

  it('returns null when session id not found', async () => {
    const { db, path } = createTempDb()
    applyCrushSchema(db, 20260127000000)
    db.close()

    const session = await parseCrushSession({
      dbPath: path,
      sessionId: 'nonexistent',
      platform: 'win32'
    })
    expect(session).toBeNull()
  })
})

// Criterion 4: Read-only scan is safe with WAL present
describe('WAL safety', () => {
  it('does not modify persisted crush.db/crush.db-wal data with a live WAL writer', async () => {
    const dir = createTempDir()
    const dbPath = join(dir, 'crush.db')
    const walPath = join(dir, 'crush.db-wal')

    // Model "Crush is running": a live writer connection keeps the WAL open.
    const writer = new Database(dbPath)
    writer.exec('PRAGMA journal_mode = WAL')
    applyCrushSchema(writer, 20260127000000)
    insertSession(writer, {
      id: 'ses_wal',
      title: 'WAL test',
      updatedAt: '2026-07-29T12:00:00.000Z',
      createdAt: '2026-07-29T10:00:00.000Z'
    })
    insertMessage(writer, {
      id: 'msg_wal_1',
      sessionId: 'ses_wal',
      role: 'user',
      parts: JSON.stringify([{ type: 'text', data: { text: 'hello wal' } }])
    })
    // Uncheckpointed frames keep crush.db-wal present while the writer lives.
    expect(existsSync(walPath)).toBe(true)

    const hashesBefore = hashFiles([dbPath, walPath])

    await listCrushSqliteSessions({ dbPaths: [dbPath], limit: 10, issues: [] })

    const session = await parseCrushSession({
      dbPath,
      sessionId: 'ses_wal',
      platform: 'win32'
    })
    expect(session).not.toBeNull()

    const hashesAfter = hashFiles([dbPath, walPath])

    // Why: node:sqlite rebuilds the WAL-index crush.db-shm on ANY open (even
    // read-only) whenever a -wal file is present, so shm is volatile connection
    // state and its byte-hash can never be stable. The safety property that
    // matters — the persisted crush.db/crush.db-wal bytes are untouched — is
    // asserted directly instead.
    expect(hashesAfter[dbPath]).toBe(hashesBefore[dbPath])
    expect(hashesAfter[walPath]).toBe(hashesBefore[walPath])

    // The live writer still functions after the scan.
    const countBefore = (
      writer.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }
    ).n
    expect(countBefore).toBe(1)
    writer
      .prepare(
        `INSERT INTO sessions (id, title, message_count, prompt_tokens, completion_tokens, updated_at, created_at)
         VALUES ('ses_after_scan', 'Written after scan', 0, 0, 0, ?, ?)`
      )
      .run('2026-07-29T13:00:00.000Z', '2026-07-29T13:00:00.000Z')
    const writtenBack = writer
      .prepare("SELECT id FROM sessions WHERE id = 'ses_after_scan'")
      .get() as { id: string } | undefined
    expect(writtenBack).toBeDefined()

    writer.close()
  })
})

// Criterion 2b: crushDiscoveries with test-injected list function
describe('crushDiscoveries', () => {
  it('discovers sessions from explicit crushDbPaths', async () => {
    const { db, path } = createTempDb()
    applyCrushSchema(db, 20260127000000)
    insertSession(db, {
      id: 'ses_explicit',
      title: 'Explicit path',
      updatedAt: '2026-07-29T12:00:00.000Z',
      createdAt: '2026-07-29T10:00:00.000Z'
    })
    db.close()

    const discoveries = await Promise.all(
      crushDiscoveries({ crushDbPaths: [path], _listFn: listCrushSqliteSessions }, 10, [])
    )
    expect(discoveries).toHaveLength(1)
    expect(discoveries[0].agent).toBe('crush')
    expect(discoveries[0].files).toHaveLength(1)
  })

  it('discovers sessions from scopePaths with .crush/crush.db', async () => {
    const dir = createTempDir()
    const crushDir = join(dir, '.crush')
    mkdirSync(crushDir, { recursive: true })
    const dbPath = join(crushDir, 'crush.db')

    const db = new Database(dbPath)
    applyCrushSchema(db, 20260127000000)
    insertSession(db, {
      id: 'ses_scope',
      title: 'Scope path',
      updatedAt: '2026-07-29T12:00:00.000Z',
      createdAt: '2026-07-29T10:00:00.000Z'
    })
    db.close()

    const discoveries = await Promise.all(
      crushDiscoveries({ scopePaths: [dir], _listFn: listCrushSqliteSessions }, 10, [])
    )
    expect(discoveries).toHaveLength(1)
    expect(discoveries[0].files).toHaveLength(1)
  })
})
