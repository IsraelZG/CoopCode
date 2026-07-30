import type { AiVaultScanIssue } from '../../shared/ai-vault-types'
import {
  buildCrushSqliteCandidatePath,
  splitCrushSqliteCandidate
} from './session-scanner-crush-paths'
import type { SessionFileCandidate } from './session-scanner-types'
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
): SessionFileCandidate {
  const mtimeMs = Date.parse(row.updated_at)
  const effectiveMtimeMs = Number.isFinite(mtimeMs) ? mtimeMs : Date.now()
  return {
    agent: 'crush',
    file: {
      path: buildCrushSqliteCandidatePath(dbPath, row.id),
      mtimeMs: effectiveMtimeMs,
      modifiedAt: new Date(effectiveMtimeMs).toISOString()
    },
    codexHome: null
  }
}

function dedupeAndSortCandidates(candidates: SessionFileCandidate[]): SessionFileCandidate[] {
  const candidatesBySessionId = new Map<string, SessionFileCandidate>()
  for (const candidate of candidates) {
    const parsed = splitCrushSqliteCandidate(candidate.file.path)
    if (!parsed) {
      continue
    }
    const previous = candidatesBySessionId.get(parsed.sessionId)
    if (!previous || candidate.file.mtimeMs > previous.file.mtimeMs) {
      candidatesBySessionId.set(parsed.sessionId, candidate)
    }
  }
  return [...candidatesBySessionId.values()].sort((left, right) => {
    return right.file.mtimeMs - left.file.mtimeMs
  })
}

/**
 * List Crush sessions from one or more crush.db SQLite databases as synthetic
 * `SessionFileCandidate` entries. Databases whose goose_db_version does not
 * match `20260127000000` are recorded as scan issues and skipped.
 * @param args.dbPaths - Absolute paths to crush.db files to scan.
 * @param args.limit - Maximum number of sessions to return per database.
 * @param args.issues - Collected scan issues to append errors to.
 * @returns Array of synthetic candidates sorted by effective recency.
 */
export async function listCrushSqliteSessions(args: {
  dbPaths: readonly string[]
  limit: number
  issues: AiVaultScanIssue[]
}): Promise<SessionFileCandidate[]> {
  const candidates: SessionFileCandidate[] = []
  for (const dbPath of args.dbPaths) {
    let db: SyncDatabase | null = null
    try {
      db = openReadonlyDatabase(dbPath)
      if (!canReadCrushSessions(db)) {
        continue
      }
      const version = checkCrushDbVersion(db, dbPath)
      if (version !== null && version !== EXPECTED_GOOSE_DB_VERSION) {
        args.issues.push({
          agent: 'crush',
          path: dbPath,
          message: `Unsupported crush.db version: ${version} (expected ${EXPECTED_GOOSE_DB_VERSION})`
        })
        continue
      }
      const rows = db.prepare(buildSessionListQuery(db)).all(args.limit) as SessionRow[]
      for (const row of rows) {
        candidates.push(rowToCandidate(row, dbPath))
      }
    } catch (err) {
      args.issues.push({
        agent: 'crush',
        path: dbPath,
        message: errorMessage(err)
      })
    } finally {
      db?.close()
    }
  }
  return dedupeAndSortCandidates(candidates)
}
