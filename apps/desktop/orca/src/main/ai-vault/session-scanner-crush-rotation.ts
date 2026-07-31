import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { AiVaultScanIssue } from '../../shared/ai-vault-types'
import { splitCrushSqliteCandidate } from './session-scanner-crush-paths'
import type { SessionFileDiscovery } from './session-scanner-types'
import type { AiVaultSession } from '../../shared/ai-vault-types'

export type CrushRotationResult = {
  backupPath: string | null
  issues: AiVaultScanIssue[]
}

export type CrushRotationCandidate = {
  dbPath: string
  // The directory Crush is invoked with via `crush --project <projectRoot>`,
  // i.e. the parent of `.crush/`, not the parent of `crush.db` itself.
  projectRoot: string
}

/**
 * Detect whether a Crush process holds crush.db open by checking the process
 * list for a `crush` binary whose command line or working directory references
 * the given project root. Uses platform-specific commands (tasklist on Windows,
 * pgrep on Linux/macOS) and node:child_process only.
 */
export function isCrushProcessRunning(
  projectRoot: string,
  options?: { platform?: NodeJS.Platform; _execFn?: typeof execFileSync }
): boolean {
  const platform = options?.platform ?? process.platform
  const execFn = options?._execFn ?? execFileSync
  const normalizedRoot = resolve(projectRoot).toLowerCase().replace(/\\/g, '/')

  try {
    if (platform === 'win32') {
      return isCrushRunningWindows(normalizedRoot, execFn)
    }
    return isCrushRunningUnix(normalizedRoot, execFn)
  } catch {
    return false
  }
}

function isCrushRunningWindows(
  normalizedRoot: string,
  execFn: typeof execFileSync
): boolean {
  const output = execFn(
    'tasklist',
    ['/FI', 'IMAGENAME eq crush.exe', '/FO', 'CSV', '/NH'],
    { encoding: 'utf-8', windowsHide: true }
  )
  if (!output.trim()) {
    return false
  }
  const lines = output.trim().split('\n')
  for (const line of lines) {
    const pidMatch = line.match(/"crush\.exe"\s*,\s*"(\d+)"/i)
    if (!pidMatch) {
      continue
    }
    const pid = pidMatch[1]
    try {
      // ponytail: wmic is deprecated since Windows 11 24H2 but still present
      // on the ARM64 target; Get-CimInstance is the forward-compatible path.
      const psOutput = execFn(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`
        ],
        { encoding: 'utf-8', windowsHide: true }
      )
      if (psOutput.toLowerCase().replace(/\\/g, '/').includes(normalizedRoot)) {
        return true
      }
    } catch {
      // Process may have exited; skip it.
    }
  }
  return false
}

function isCrushRunningUnix(
  normalizedRoot: string,
  execFn: typeof execFileSync
): boolean {
  const output = execFn('pgrep', ['-f', 'crush'], { encoding: 'utf-8' })
  if (!output.trim()) {
    return false
  }
  const pids = output.trim().split('\n').filter(Boolean)
  for (const pid of pids) {
    try {
      const cmdline = execFn('cat', [`/proc/${pid}/cmdline`], { encoding: 'utf-8' })
      if (cmdline.toLowerCase().replace(/\\/g, '/').includes(normalizedRoot)) {
        return true
      }
    } catch {
      try {
        const psOutput = execFn('ps', ['-p', pid, '-o', 'args='], { encoding: 'utf-8' })
        if (psOutput.toLowerCase().replace(/\\/g, '/').includes(normalizedRoot)) {
          return true
        }
      } catch {
        // Process may have exited; skip it.
      }
    }
  }
  return false
}

/**
 * Rename crush.db to a timestamped backup and remove WAL/SHM siblings.
 * Returns the backup path on success, or null when crush.db is absent or
 * a Crush process still holds it open.
 * @param dbPath - Path to crush.db.
 * @param projectRoot - The directory Crush was launched against
 *   (`crush --project <projectRoot>`), i.e. the parent of `.crush/`. Must be
 *   passed explicitly rather than derived from `dbPath` here, since callers
 *   (and tests) may not follow the `<projectRoot>/.crush/crush.db` layout.
 */
export async function rotateCrushDatabase(
  dbPath: string,
  projectRoot: string,
  options?: {
    platform?: NodeJS.Platform
    _execFn?: typeof execFileSync
    _now?: () => Date
    _unlinkFn?: typeof unlink
  }
): Promise<CrushRotationResult> {
  const issues: AiVaultScanIssue[] = []
  const resolvedPath = resolve(dbPath)

  if (!existsSync(resolvedPath)) {
    return { backupPath: null, issues }
  }

  if (isCrushProcessRunning(projectRoot, options)) {
    issues.push({
      agent: 'crush',
      path: resolvedPath,
      message: 'Crush process is still running; rotation skipped'
    })
    return { backupPath: null, issues }
  }

  const now = options?._now ? options._now() : new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-')
  const backupPath = `${resolvedPath}.${timestamp}.bak`

  try {
    await rename(resolvedPath, backupPath)
  } catch (err) {
    issues.push({
      agent: 'crush',
      path: resolvedPath,
      message: `Failed to rename crush.db to backup: ${(err as Error).message}`
    })
    return { backupPath: null, issues }
  }

  const walPath = `${resolvedPath}-wal`
  const shmPath = `${resolvedPath}-shm`
  const unlinkFn = options?._unlinkFn ?? unlink

  if (existsSync(walPath)) {
    try {
      await unlinkFn(walPath)
    } catch (err) {
      issues.push({
        agent: 'crush',
        path: walPath,
        message: `Failed to delete WAL file after rotation: ${(err as Error).message}`
      })
    }
  }

  if (existsSync(shmPath)) {
    try {
      await unlinkFn(shmPath)
    } catch (err) {
      issues.push({
        agent: 'crush',
        path: shmPath,
        message: `Failed to delete SHM file after rotation: ${(err as Error).message}`
      })
    }
  }

  return { backupPath, issues }
}

/**
 * Determine which crush.db files are safe to rotate: every session discovered
 * from that DB must appear in the scanned sessions (matched by sessionId),
 * and the DB's own last-write time must be no later than `asOfMs` — proving
 * a full scan completed after the DB was last written, so nothing written
 * mid-scan is silently discarded by rotation.
 */
export function computeCrushRotationCandidates(
  scannedSessions: readonly AiVaultSession[],
  discoveries: readonly SessionFileDiscovery[],
  options?: {
    asOfMs?: number
    _statFn?: (path: string) => { mtimeMs: number }
  }
): CrushRotationCandidate[] {
  const asOfMs = options?.asOfMs ?? Date.now()
  const statFn = options?._statFn ?? statSync
  const scannedSessionIds = new Set(scannedSessions.map((session) => session.sessionId))
  const candidates: CrushRotationCandidate[] = []

  for (const discovery of discoveries) {
    if (discovery.agent !== 'crush') {
      continue
    }
    const dbPath = discovery.rootDir
    let allSessionsFound = true
    let hasSessions = false

    for (const file of discovery.files) {
      const parsed = splitCrushSqliteCandidate(file.path)
      if (!parsed || parsed.dbPath !== dbPath) {
        continue
      }
      hasSessions = true
      if (!scannedSessionIds.has(parsed.sessionId)) {
        allSessionsFound = false
        break
      }
    }

    if (!hasSessions || !allSessionsFound) {
      continue
    }

    let dbMtimeMs: number
    try {
      dbMtimeMs = statFn(dbPath).mtimeMs
    } catch {
      continue
    }
    if (dbMtimeMs > asOfMs) {
      continue
    }

    candidates.push({ dbPath, projectRoot: dirname(dirname(dbPath)) })
  }

  return candidates
}
