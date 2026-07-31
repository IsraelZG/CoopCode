import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import type { AiVaultScanIssue, AiVaultSession } from '../../shared/ai-vault-types'
import type { SessionFileCandidate } from './session-scanner-types'
import { CrushSqliteWorkerClient } from './session-scanner-crush-worker-client'

function resolveWorkerEntryPath(): string {
  let app: { isPackaged: boolean } | null = null
  try {
    app = require('electron').app ?? null
  } catch {
    app = null
  }
  if (app?.isPackaged) {
    return join(
      process.resourcesPath,
      'app.asar',
      'out',
      'main',
      'session-scanner-crush-worker-entry.js'
    )
  }
  return join(__dirname, 'session-scanner-crush-worker-entry.js')
}

function defaultWorkerFactory(): Worker {
  const workerPath = resolveWorkerEntryPath()
  if (!existsSync(workerPath)) {
    throw new Error(`Crush SQLite worker entry not found: ${workerPath}`)
  }
  return new Worker(workerPath)
}

let sharedClient: CrushSqliteWorkerClient | null = null

function getSharedClient(): CrushSqliteWorkerClient {
  sharedClient ??= new CrushSqliteWorkerClient({ workerFactory: defaultWorkerFactory })
  return sharedClient
}

/**
 * List Crush SQLite session candidates through the shared worker client.
 * @param args.dbPaths - Absolute paths to crush.db files to scan.
 * @param args.limit - Maximum number of sessions to return per database.
 * @param args.issues - Collected scan issues to append errors to.
 * @returns Synthetic candidates sorted by effective recency.
 */
export function listCrushSessionsViaWorker(args: {
  dbPaths: readonly string[]
  limit: number
  issues: AiVaultScanIssue[]
}): Promise<SessionFileCandidate[]> {
  return getSharedClient().list(args)
}

/**
 * Parse one Crush SQLite session through the shared worker client.
 * @param args.dbPath - Absolute path to the crush.db file.
 * @param args.sessionId - Primary key in the `sessions` table.
 * @param args.platform - Platform used for resume-command generation.
 * @returns The parsed session, or `null` when it does not exist.
 */
export function parseCrushSessionViaWorker(args: {
  dbPath: string
  sessionId: string
  platform: NodeJS.Platform
}): Promise<AiVaultSession | null> {
  return getSharedClient().parse(args)
}
