import { parentPort } from 'node:worker_threads'
import type { AiVaultScanIssue } from '../../shared/ai-vault-types'
import { listCrushSqliteSessions } from './session-scanner-crush-list'
import { parseCrushSession } from './session-scanner-crush-parser'
import type {
  CrushSqliteWorkerRequest,
  CrushSqliteWorkerResponse
} from './session-scanner-crush-worker-protocol'

if (!parentPort) {
  throw new Error('Crush SQLite worker must run with a parent port.')
}
const port = parentPort

async function handleRequest(
  request: CrushSqliteWorkerRequest
): Promise<CrushSqliteWorkerResponse> {
  try {
    if (request.kind === 'list') {
      const issues: AiVaultScanIssue[] = []
      const candidates = await listCrushSqliteSessions({
        dbPaths: request.dbPaths,
        limit: request.limit,
        issues
      })
      return { id: request.id, ok: true, value: { candidates, issues } }
    }
    const session = await parseCrushSession({
      dbPath: request.dbPath,
      sessionId: request.sessionId,
      platform: request.platform
    })
    return { id: request.id, ok: true, value: session }
  } catch (err) {
    return { id: request.id, ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

port.on('message', (request: CrushSqliteWorkerRequest) => {
  void handleRequest(request).then((response) => {
    try {
      port.postMessage(response)
    } catch {
      port.postMessage({
        id: request.id,
        ok: false,
        error: 'Crush SQLite worker result could not be serialized.'
      })
    }
  })
})
