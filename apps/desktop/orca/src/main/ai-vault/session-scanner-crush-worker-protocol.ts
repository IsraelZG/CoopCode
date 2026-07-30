import type { AiVaultScanIssue, AiVaultSession } from '../../shared/ai-vault-types'
import type { SessionFileCandidate } from './session-scanner-types'

export type CrushSqliteListRequest = {
  id: number
  kind: 'list'
  dbPaths: readonly string[]
  limit: number
}

export type CrushSqliteParseRequest = {
  id: number
  kind: 'parse'
  dbPath: string
  sessionId: string
  platform: NodeJS.Platform
}

export type CrushSqliteWorkerRequest = CrushSqliteListRequest | CrushSqliteParseRequest

export type CrushSqliteListValue = {
  candidates: SessionFileCandidate[]
  issues: AiVaultScanIssue[]
}

export type CrushSqliteParseValue = AiVaultSession | null

export type CrushSqliteWorkerResponse =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: string }
