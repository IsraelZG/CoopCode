import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AiVaultScanIssue } from '../../shared/ai-vault-types'
import { listCrushSessionsViaWorker } from './session-scanner-crush-worker-spawn'
import { splitCrushSqliteCandidate } from './session-scanner-crush-paths'
import type {
  FileWithMtime,
  SessionFileCandidate,
  SessionFileDiscovery
} from './session-scanner-types'

type ListFn = (args: {
  dbPaths: readonly string[]
  limit: number
  issues: AiVaultScanIssue[]
}) => Promise<SessionFileCandidate[]>

/**
 * Discover Crush sessions from project/worktree roots and explicit DB paths.
 * Checks each scope path for <root>/.crush/crush.db and also scans any
 * explicitly provided crushDbPaths. All SQLite reads run on a worker thread
 * to keep the main-process event loop responsive even with large crush.db files.
 * @param options - Scan options carrying scope paths, crushDbPaths, and an
 *   optional _listFn for test injection (bypasses the worker thread).
 * @param limitPerAgent - Maximum number of sessions per discovery.
 * @param issues - Collected scan issues to append errors to.
 * @returns Array of session discoveries for the 'crush' agent.
 */
export function crushDiscoveries(
  options: {
    scopePaths?: readonly string[]
    crushDbPaths?: readonly string[]
    _listFn?: ListFn
  },
  limitPerAgent: number,
  issues: AiVaultScanIssue[]
): Promise<SessionFileDiscovery>[] {
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

  if (dbPaths.size === 0) {
    return []
  }

  const listFn = options._listFn ?? listCrushSessionsViaWorker
  const candidatesPromise = listFn({
    dbPaths: [...dbPaths],
    limit: limitPerAgent,
    issues
  })

  return [...dbPaths].map((dbPath): Promise<SessionFileDiscovery> =>
    candidatesPromise.then((candidates) => {
      const files = candidates
        .map((candidate) => {
          const parsed = splitCrushSqliteCandidate(candidate.file.path)
          return parsed?.dbPath === dbPath ? candidate.file : null
        })
        .filter((file): file is FileWithMtime => file !== null)
      return { agent: 'crush' as const, rootDir: dbPath, files }
    })
  )
}
