import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { type AiVaultScanIssue } from '../../shared/ai-vault-types'
import {
  buildCrushSqliteCandidatePath,
  splitCrushSqliteCandidate
} from './session-scanner-crush-paths'
import type { SessionFileDiscovery } from './session-scanner-types'
import { errorMessage } from './session-scanner-values'
import SyncDatabase from '../sqlite/sync-database'
import { columnExists, tableExists } from '../opencode-usage/schema-helpers'

const EXPECTED_GOOSE_DB_VERSION = '20260127000000'

type SessionRow = {
  id: string
  created_at: string
  updated_at: string
}

function openReadonlyDatabase(dbPath: string): SyncDatabase {
  const db = new SyncDatabase(dbPath, { readonly: true, fileMustExist: true })
  db.pragma('query_only = ON')
  return db
}

function canReadCrushSessions(db: SyncDatabase): boolean {
  return (
    tableExists(db, 'sessions') &&
    columnExists(db, 'sessions', 'id') &&
    columnExists(db, 'sessions', 'created_at') &&
    columnExists(db, 'sessions', 'updated_at')
  )
}

function checkCrushDbVersion(db: SyncDatabase, dbPath: string): string | null {
  if (!tableExists(db, 'goose_db_version')) {
    return null
  }
  if (!columnExists(db, 'goose_db_version', 'version_id')) {
    return null
  }
  const row = db
    .prepare('SELECT version_id FROM goose_db_version ORDER BY id DESC LIMIT 1')
    .get() as { version_id?: number } | undefined
  if (!row || row.version_id === undefined) {
    return null
  }
  return String(row.version_id)
}

function buildSessionListQuery(db: SyncDatabase): string {
  const parentIdPredicate = columnExists(db, 'sessions', 'parent_session_id')
    ? 'AND parent_session_id IS NULL'
    : ''
  return `SELECT id, created_at, updated_at
          FROM sessions
          WHERE 1=1 ${parentIdPredicate}
          ORDER BY updated_at DESC
          LIMIT ?`
}

function rowToCandidate(
  row: SessionRow,
  dbPath: string
): { path: string; mtimeMs: number; modifiedAt: string } {
  const mtimeMs = Date.parse(row.updated_at)
  const effectiveMtimeMs = Number.isFinite(mtimeMs) ? mtimeMs : Date.now()
  return {
    path: buildCrushSqliteCandidatePath(dbPath, row.id),
    mtimeMs: effectiveMtimeMs,
    modifiedAt: new Date(effectiveMtimeMs).toISOString()
  }
}

/**
 * Discover Crush sessions from one or more crush.db files. Each database is
 * opened read-only to list session ids and timestamps; full session metadata
 * is parsed lazily by the parser. Databases whose schema version does not
 * match the expected goose_db_version are recorded as scan issues and produce
 * no candidates.
 * @param args.dbPath - Absolute path to a crush.db file.
 * @param args.limitPerAgent - Maximum number of candidates to return.
 * @param args.issues - Collected scan issues to append errors to.
 * @returns A `SessionFileDiscovery` with agent 'crush' and synthetic file entries.
 */
export async function discoverCrushSessions(args: {
  dbPath: string
  limitPerAgent: number
  issues: AiVaultScanIssue[]
}): Promise<SessionFileDiscovery | null> {
  const { dbPath, limitPerAgent, issues } = args
  let db: SyncDatabase | null = null
  try {
    db = openReadonlyDatabase(dbPath)
    if (!canReadCrushSessions(db)) {
      return null
    }
    const version = checkCrushDbVersion(db, dbPath)
    if (version !== null && version !== EXPECTED_GOOSE_DB_VERSION) {
      issues.push({
        agent: 'crush',
        path: dbPath,
        message: `Unsupported crush.db version: ${version} (expected ${EXPECTED_GOOSE_DB_VERSION})`
      })
      return null
    }
    const rows = db.prepare(buildSessionListQuery(db)).all(limitPerAgent) as SessionRow[]
    const files = rows.map((row) => rowToCandidate(row, dbPath))
    return {
      agent: 'crush' as const,
      rootDir: dbPath,
      files
    }
  } catch (err) {
    issues.push({
      agent: 'crush',
      path: dbPath,
      message: errorMessage(err)
    })
    return null
  } finally {
    db?.close()
  }
}

/**
 * Discover Crush sessions from project/worktree roots and explicit DB paths.
 * Checks each scope path for <root>/.crush/crush.db and also scans any
 * explicitly provided crushDbPaths.
 * @param options - Scan options carrying scope paths and optional crushDbPaths.
 * @param limitPerAgent - Maximum number of sessions per discovery.
 * @param issues - Collected scan issues to append errors to.
 * @returns Array of session discoveries for the 'crush' agent.
 */
export async function crushDiscoveries(
  options: { scopePaths?: readonly string[]; crushDbPaths?: readonly string[] },
  limitPerAgent: number,
  issues: AiVaultScanIssue[]
): Promise<SessionFileDiscovery[]> {
  const dbPaths = new Set<string>()

  if (options.crushDbPaths) {
    for (const dbPath of options.crushDbPaths) {
      dbPaths.add(dbPath)
    }
  }

  if (options.scopePaths) {
    for (const scopePath of options.scopePaths) {
      const crushDbPath = join(scopePath, '.crush', 'crush.db')
      if (existsSync(crushDbPath)) {
        dbPaths.add(crushDbPath)
      }
    }
  }

  const discoveries: SessionFileDiscovery[] = []
  for (const dbPath of dbPaths) {
    const discovery = await discoverCrushSessions({ dbPath, limitPerAgent, issues })
    if (discovery && discovery.files.length > 0) {
      discoveries.push(discovery)
    }
  }
  return discoveries
}
