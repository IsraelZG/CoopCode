import { basename } from 'node:path'

const CRUSH_SQLITE_PATH_SEPARATOR = '#'

export function buildCrushSqliteCandidatePath(dbPath: string, sessionId: string): string {
  return `${dbPath}${CRUSH_SQLITE_PATH_SEPARATOR}${sessionId}`
}

export function splitCrushSqliteCandidate(
  candidatePath: string
): { dbPath: string; sessionId: string } | null {
  const separatorIndex = candidatePath.lastIndexOf(CRUSH_SQLITE_PATH_SEPARATOR)
  if (separatorIndex <= 0 || separatorIndex === candidatePath.length - 1) {
    return null
  }
  const dbPath = candidatePath.slice(0, separatorIndex)
  const sessionId = candidatePath.slice(separatorIndex + 1)
  if (!dbPath || !sessionId) {
    return null
  }
  if (!/^crush\.db$/i.test(basename(dbPath))) {
    return null
  }
  return { dbPath, sessionId }
}

export function looksLikeCrushSqliteCandidate(candidatePath: string): boolean {
  return splitCrushSqliteCandidate(candidatePath) !== null
}
