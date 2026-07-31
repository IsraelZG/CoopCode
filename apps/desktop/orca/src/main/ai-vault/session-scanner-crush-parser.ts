import type { AiVaultSession, AiVaultSessionPreviewMessage } from '../../shared/ai-vault-types'
import {
  addPreviewMessage,
  createAccumulator,
  finalizeSession,
  updateTimeline
} from './session-scanner-accumulator'
import { normalizePreviewText, timestampMs } from './session-scanner-values'
import SyncDatabase from '../sqlite/sync-database'
import { columnExists, tableExists } from '../opencode-usage/schema-helpers'

const CRUSH_PREVIEW_LIMIT = 5

type CrushSessionRow = {
  id: string
  parent_session_id: string | null
  title: string | null
  message_count: number
  prompt_tokens: number
  completion_tokens: number
  cost: number
  updated_at: string | number
  created_at: string | number
}

type CrushMessageRow = {
  role: string
  parts: string
  created_at: string
}

function openReadonlyDatabase(dbPath: string): SyncDatabase {
  const db = new SyncDatabase(dbPath, { readonly: true, fileMustExist: true })
  db.pragma('query_only = ON')
  return db
}

function canReadCrushSessionsForParse(db: SyncDatabase): boolean {
  return (
    tableExists(db, 'sessions') &&
    columnExists(db, 'sessions', 'id') &&
    columnExists(db, 'sessions', 'created_at') &&
    columnExists(db, 'sessions', 'updated_at')
  )
}

function canReadCrushMessages(db: SyncDatabase): boolean {
  return (
    tableExists(db, 'messages') &&
    columnExists(db, 'messages', 'session_id') &&
    columnExists(db, 'messages', 'parts')
  )
}

function buildCrushSessionQuery(db: SyncDatabase): string {
  const titleSelect = columnExists(db, 'sessions', 'title') ? 'title' : 'NULL AS title'
  const messageCountSelect = columnExists(db, 'sessions', 'message_count')
    ? 'message_count'
    : '0 AS message_count'
  const promptTokensSelect = columnExists(db, 'sessions', 'prompt_tokens')
    ? 'prompt_tokens'
    : '0 AS prompt_tokens'
  const completionTokensSelect = columnExists(db, 'sessions', 'completion_tokens')
    ? 'completion_tokens'
    : '0 AS completion_tokens'
  const costSelect = columnExists(db, 'sessions', 'cost') ? 'cost' : '0 AS cost'
  const updatedAtSelect = columnExists(db, 'sessions', 'updated_at')
    ? 'updated_at'
    : "datetime('now') AS updated_at"
  const createdAtSelect = columnExists(db, 'sessions', 'created_at')
    ? 'created_at'
    : "datetime('now') AS created_at"
  const parentSessionIdSelect = columnExists(db, 'sessions', 'parent_session_id')
    ? 'parent_session_id'
    : 'NULL AS parent_session_id'

  return `SELECT id, ${parentSessionIdSelect},
                 ${titleSelect},
                 ${messageCountSelect},
                 ${promptTokensSelect},
                 ${completionTokensSelect},
                 ${costSelect},
                 ${updatedAtSelect},
                 ${createdAtSelect}
          FROM sessions
          WHERE id = ?
          LIMIT 1`
}

function parseCrushParts(partsJson: string): { text: string }[] {
  try {
    const parsed = JSON.parse(partsJson) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter(
        (part): part is { type: string; data: unknown } =>
          part !== null && typeof part === 'object' && typeof (part as Record<string, unknown>).type === 'string'
      )
      .map((part) => {
        const data = part.data
        if (data !== null && typeof data === 'object') {
          const record = data as Record<string, unknown>
          if (typeof record.text === 'string') {
            return { text: record.text }
          }
          if (typeof record.thinking === 'string') {
            return { text: record.thinking }
          }
        }
        return { text: '' }
      })
  } catch {
    return []
  }
}

function mapCrushRole(role: string): AiVaultSessionPreviewMessage['role'] {
  switch (role) {
    case 'user':
    case 'assistant':
    case 'system':
      return role
    default:
      return 'unknown'
  }
}

/**
 * Parse a single Crush session from the SQLite database into an
 * `AiVaultSession`. Reads session metadata (title, timestamps, token counts)
 * and up to 5 preview messages from `messages.parts` by type discriminator.
 * The database is opened read-only; a version mismatch against
 * `goose_db_version.version_id` is NOT checked here — the discovery layer
 * catches version mismatches and skips those databases.
 * @param args.dbPath - Absolute path to the crush.db file.
 * @param args.sessionId - The session ID (primary key in the `sessions` table).
 * @param args.platform - The platform to use for resume command generation.
 * @returns The parsed `AiVaultSession`, or `null` if parsing fails.
 */
export async function parseCrushSession(args: {
  dbPath: string
  sessionId: string
  platform: NodeJS.Platform
}): Promise<AiVaultSession | null> {
  const { dbPath, sessionId, platform } = args
  let db: SyncDatabase | null = null
  try {
    db = openReadonlyDatabase(dbPath)
    if (!canReadCrushSessionsForParse(db)) {
      return null
    }

    const row = db.prepare(buildCrushSessionQuery(db)).get(sessionId) as
      | CrushSessionRow
      | undefined
    if (!row || row.id !== sessionId) {
      return null
    }

    const createdAtMs = timestampMs(row.created_at)
    const updatedAtMs = timestampMs(row.updated_at)
    const effectiveMtimeMs = Number.isFinite(updatedAtMs) ? updatedAtMs : Date.now()

    const accumulator = createAccumulator({
      agent: 'crush',
      file: {
        path: dbPath,
        mtimeMs: effectiveMtimeMs,
        modifiedAt: new Date(effectiveMtimeMs).toISOString()
      },
      sessionId
    })

    accumulator.title = normalizePreviewText(row.title ?? '')
    accumulator.messageCount = typeof row.message_count === 'number' ? row.message_count : 0
    accumulator.totalTokens =
      (typeof row.prompt_tokens === 'number' ? row.prompt_tokens : 0) +
      (typeof row.completion_tokens === 'number' ? row.completion_tokens : 0)

    if (Number.isFinite(createdAtMs)) {
      updateTimeline(accumulator, createdAtMs)
    }
    if (Number.isFinite(updatedAtMs)) {
      updateTimeline(accumulator, updatedAtMs)
    }

    if (canReadCrushMessages(db)) {
      const messageRows = db
        .prepare(
          `SELECT role, parts, created_at
           FROM messages
           WHERE session_id = ?
           ORDER BY created_at DESC
           LIMIT ?`
        )
        .all(sessionId, CRUSH_PREVIEW_LIMIT * 2) as CrushMessageRow[]

      const previewParts: { role: string; text: string; timestamp: string | null }[] = []
      for (const msgRow of messageRows) {
        const parts = parseCrushParts(msgRow.parts)
        for (const part of parts) {
          if (!part.text) {
            continue
          }
          previewParts.push({
            role: msgRow.role,
            text: part.text,
            timestamp: msgRow.created_at
          })
          if (previewParts.length >= CRUSH_PREVIEW_LIMIT) {
            break
          }
        }
        if (previewParts.length >= CRUSH_PREVIEW_LIMIT) {
          break
        }
      }

      for (let i = previewParts.length - 1; i >= 0; i--) {
        const part = previewParts[i]
        if (!part) {
          continue
        }
        addPreviewMessage(accumulator, {
          role: mapCrushRole(part.role),
          text: part.text,
          timestamp: part.timestamp
        })
      }
    }

    return finalizeSession(accumulator, platform)
  } finally {
    db?.close()
  }
}
