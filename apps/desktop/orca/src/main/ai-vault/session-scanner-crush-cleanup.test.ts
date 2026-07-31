import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AiVaultSession } from '../../shared/ai-vault-types'
import type { SessionFileDiscovery } from './session-scanner-types'
import { buildCrushSqliteCandidatePath } from './session-scanner-crush-paths'
import {
  computeCrushRotationCandidates,
  isCrushProcessRunning,
  rotateCrushDatabase
} from './session-scanner-crush-rotation'

let tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs = []
})

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orca-crush-rotation-'))
  tempDirs.push(dir)
  return dir
}

// Real layout is <projectRoot>/.crush/crush.db — fixtures must follow it, or
// they mask exactly the projectRoot bug this suite exists to catch.
function createCrushDbWithSiblings(projectRoot: string): string {
  const crushDir = join(projectRoot, '.crush')
  mkdirSync(crushDir, { recursive: true })
  const dbPath = join(crushDir, 'crush.db')
  writeFileSync(dbPath, 'fake-db-content')
  writeFileSync(`${dbPath}-wal`, 'fake-wal-content')
  writeFileSync(`${dbPath}-shm`, 'fake-shm-content')
  return dbPath
}

function makeMockExecFn(args: {
  tasklistOutput?: string
  powershellOutput?: string
  pgrepOutput?: string
  cmdlineOutput?: string
  psOutput?: string
}): typeof import('node:child_process').execFileSync {
  return ((command: string, cmdArgs: readonly string[], _options?: unknown) => {
    if (command === 'tasklist') {
      return args.tasklistOutput ?? ''
    }
    if (command === 'powershell') {
      return args.powershellOutput ?? ''
    }
    if (command === 'pgrep') {
      return args.pgrepOutput ?? ''
    }
    if (command === 'cat') {
      return args.cmdlineOutput ?? ''
    }
    if (command === 'ps') {
      return args.psOutput ?? ''
    }
    return ''
  }) as typeof import('node:child_process').execFileSync
}

describe('isCrushProcessRunning', () => {
  it('returns false when no crush process exists (Windows)', () => {
    const mockExec = makeMockExecFn({ tasklistOutput: '' })
    const result = isCrushProcessRunning('/some/project', {
      platform: 'win32',
      _execFn: mockExec
    })
    expect(result).toBe(false)
  })

  it('returns true when crush process references the project root (Windows)', () => {
    const projectRoot = 'C:\\Dev2026\\agentic-ide'
    const mockExec = makeMockExecFn({
      tasklistOutput: '"crush.exe","1234","Console","1","100,000 K"',
      powershellOutput: `crush --project ${projectRoot}`
    })
    const result = isCrushProcessRunning(projectRoot, {
      platform: 'win32',
      _execFn: mockExec
    })
    expect(result).toBe(true)
  })

  it('returns false when crush process does not reference the project root (Windows)', () => {
    const mockExec = makeMockExecFn({
      tasklistOutput: '"crush.exe","1234","Console","1","100,000 K"',
      powershellOutput: 'crush --project C:\\Other\\Project'
    })
    const result = isCrushProcessRunning('C:\\Dev2026\\agentic-ide', {
      platform: 'win32',
      _execFn: mockExec
    })
    expect(result).toBe(false)
  })

  it('returns false when no crush process exists (Linux)', () => {
    const mockExec = makeMockExecFn({ pgrepOutput: '' })
    const result = isCrushProcessRunning('/some/project', {
      platform: 'linux',
      _execFn: mockExec
    })
    expect(result).toBe(false)
  })

  it('returns true when crush process references the project root (Linux)', () => {
    // This test uses Unix-style paths which don't work correctly on Windows
    // due to path.resolve converting them. Skip on Windows.
    if (process.platform === 'win32') {
      return
    }
    const projectRoot = '/some/project'
    const mockExec = makeMockExecFn({
      pgrepOutput: '5678\n',
      cmdlineOutput: '/usr/bin/crush\x00--project\x00/some/project'
    })
    const result = isCrushProcessRunning(projectRoot, {
      platform: 'linux',
      _execFn: mockExec
    })
    expect(result).toBe(true)
  })

  it('falls back to ps when /proc is unavailable (macOS)', () => {
    // This test uses Unix-style paths which don't work correctly on Windows
    // due to path.resolve converting them. Skip on Windows.
    if (process.platform === 'win32') {
      return
    }
    const mockExec = makeMockExecFn({
      pgrepOutput: '9012',
      psOutput: 'crush --project /some/project'
    })
    // Simulate /proc failure by making cat throw
    const failingExec = ((command: string, cmdArgs: readonly string[], options?: unknown) => {
      if (command === 'cat') {
        throw new Error('ENOENT')
      }
      return mockExec(command, cmdArgs, options)
    }) as typeof import('node:child_process').execFileSync

    const result = isCrushProcessRunning('/some/project', {
      platform: 'darwin',
      _execFn: failingExec
    })
    expect(result).toBe(true)
  })
})

describe('rotateCrushDatabase', () => {
  it('returns null when crush.db does not exist', async () => {
    const projectRoot = createTempDir()
    const dbPath = join(projectRoot, '.crush', 'crush.db')
    const result = await rotateCrushDatabase(dbPath, projectRoot)
    expect(result.backupPath).toBeNull()
    expect(result.issues).toEqual([])
  })

  it('renames crush.db to timestamped backup and removes WAL/SHM', async () => {
    const projectRoot = createTempDir()
    const dbPath = createCrushDbWithSiblings(projectRoot)
    const fixedDate = new Date('2026-07-31T10:00:00.000Z')
    const mockExec = makeMockExecFn({ tasklistOutput: '' })

    const result = await rotateCrushDatabase(dbPath, projectRoot, {
      platform: 'win32',
      _execFn: mockExec,
      _now: () => fixedDate
    })

    expect(result.backupPath).toBe(`${dbPath}.2026-07-31T10-00-00-000Z.bak`)
    expect(existsSync(result.backupPath!)).toBe(true)
    expect(existsSync(dbPath)).toBe(false)
    expect(existsSync(`${dbPath}-wal`)).toBe(false)
    expect(existsSync(`${dbPath}-shm`)).toBe(false)
    expect(result.issues).toEqual([])
  })

  it('rotates even when WAL/SHM do not exist', async () => {
    const projectRoot = createTempDir()
    const crushDir = join(projectRoot, '.crush')
    mkdirSync(crushDir, { recursive: true })
    const dbPath = join(crushDir, 'crush.db')
    writeFileSync(dbPath, 'fake-db-content')
    const mockExec = makeMockExecFn({ tasklistOutput: '' })

    const result = await rotateCrushDatabase(dbPath, projectRoot, {
      platform: 'win32',
      _execFn: mockExec
    })

    expect(result.backupPath).not.toBeNull()
    expect(existsSync(result.backupPath!)).toBe(true)
    expect(existsSync(dbPath)).toBe(false)
    expect(result.issues).toEqual([])
  })

  it('skips rotation and returns issue when Crush is running', async () => {
    const projectRoot = createTempDir()
    const dbPath = createCrushDbWithSiblings(projectRoot)
    // The process command line references projectRoot (the --project value),
    // not the .crush/ subdirectory crush.db actually lives in.
    const mockExec = makeMockExecFn({
      tasklistOutput: '"crush.exe","1234","Console","1","100,000 K"',
      powershellOutput: `crush --project ${projectRoot}`
    })

    const result = await rotateCrushDatabase(dbPath, projectRoot, {
      platform: 'win32',
      _execFn: mockExec
    })

    expect(result.backupPath).toBeNull()
    expect(existsSync(dbPath)).toBe(true)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].agent).toBe('crush')
    expect(result.issues[0].message).toContain('still running')
  })

  it('leaves diagnostic issue on partial failure (WAL delete fails)', async () => {
    const projectRoot = createTempDir()
    const dbPath = createCrushDbWithSiblings(projectRoot)
    const mockExec = makeMockExecFn({ tasklistOutput: '' })
    const walPath = `${dbPath}-wal`

    const result = await rotateCrushDatabase(dbPath, projectRoot, {
      platform: 'win32',
      _execFn: mockExec,
      _unlinkFn: async (path) => {
        if (path === walPath) {
          throw new Error('EBUSY: resource busy or locked')
        }
        return unlink(path)
      }
    })

    // Rename and SHM cleanup still succeed; only the WAL delete failed.
    expect(result.backupPath).not.toBeNull()
    expect(existsSync(dbPath)).toBe(false)
    expect(existsSync(walPath)).toBe(true)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].path).toBe(walPath)
    expect(result.issues[0].message).toContain('Failed to delete WAL file')
  })
})

describe('computeCrushRotationCandidates', () => {
  function makeSession(sessionId: string): AiVaultSession {
    return {
      id: sessionId,
      executionHostId: 'local',
      agent: 'crush',
      sessionId,
      title: 'Test Session',
      cwd: null,
      branch: null,
      model: null,
      filePath: `/fake/path/crush.db#${sessionId}`,
      codexHome: null,
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z',
      modifiedAt: '2026-07-31T00:00:00.000Z',
      messageCount: 5,
      totalTokens: 1000,
      previewMessages: [],
      queuedMessageCount: 0,
      subagentTranscriptCount: 0,
      resumeCommand: 'crush resume',
      subagent: null
    }
  }

  function makeDiscovery(dbPath: string, sessionIds: string[]): SessionFileDiscovery {
    return {
      agent: 'crush',
      rootDir: dbPath,
      files: sessionIds.map((id) => ({
        path: buildCrushSqliteCandidatePath(dbPath, id),
        mtimeMs: Date.now(),
        modifiedAt: new Date().toISOString()
      }))
    }
  }

  // Fixed instant every test treats as "now the scan started" and a DB mtime
  // safely before it, so the recency check passes unless a test overrides one.
  const scanStartedAtMs = Date.parse('2026-07-31T12:00:00.000Z')
  const dbWrittenBeforeScan = () => ({ mtimeMs: scanStartedAtMs - 60_000 })

  it('returns dbPath/projectRoot when all discovered sessions are in scanned sessions', () => {
    const dbPath = '/fake/project/.crush/crush.db'
    const sessions = [makeSession('ses_1'), makeSession('ses_2')]
    const discoveries = [makeDiscovery(dbPath, ['ses_1', 'ses_2'])]

    const candidates = computeCrushRotationCandidates(sessions, discoveries, {
      asOfMs: scanStartedAtMs,
      _statFn: dbWrittenBeforeScan
    })
    expect(candidates).toEqual([{ dbPath, projectRoot: '/fake/project' }])
  })

  it('returns empty when a discovered session is missing from scanned sessions', () => {
    const dbPath = '/fake/project/.crush/crush.db'
    const sessions = [makeSession('ses_1')]
    const discoveries = [makeDiscovery(dbPath, ['ses_1', 'ses_2'])]

    const candidates = computeCrushRotationCandidates(sessions, discoveries, {
      asOfMs: scanStartedAtMs,
      _statFn: dbWrittenBeforeScan
    })
    expect(candidates).toEqual([])
  })

  it('ignores non-crush discoveries', () => {
    const dbPath = '/fake/project/.crush/crush.db'
    const sessions = [makeSession('ses_1')]
    const discoveries: SessionFileDiscovery[] = [
      { agent: 'claude', rootDir: '/fake/claude', files: [] },
      makeDiscovery(dbPath, ['ses_1'])
    ]

    const candidates = computeCrushRotationCandidates(sessions, discoveries, {
      asOfMs: scanStartedAtMs,
      _statFn: dbWrittenBeforeScan
    })
    expect(candidates).toEqual([{ dbPath, projectRoot: '/fake/project' }])
  })

  it('returns empty when discovery has no files', () => {
    const dbPath = '/fake/project/.crush/crush.db'
    const sessions = [makeSession('ses_1')]
    const discoveries: SessionFileDiscovery[] = [
      { agent: 'crush', rootDir: dbPath, files: [] }
    ]

    const candidates = computeCrushRotationCandidates(sessions, discoveries, {
      asOfMs: scanStartedAtMs,
      _statFn: dbWrittenBeforeScan
    })
    expect(candidates).toEqual([])
  })

  it('handles multiple crush databases independently', () => {
    const dbPath1 = '/fake/project1/.crush/crush.db'
    const dbPath2 = '/fake/project2/.crush/crush.db'
    const sessions = [makeSession('ses_1'), makeSession('ses_2')]
    const discoveries = [
      makeDiscovery(dbPath1, ['ses_1']),
      makeDiscovery(dbPath2, ['ses_2', 'ses_3'])
    ]

    const candidates = computeCrushRotationCandidates(sessions, discoveries, {
      asOfMs: scanStartedAtMs,
      _statFn: dbWrittenBeforeScan
    })
    expect(candidates).toEqual([{ dbPath: dbPath1, projectRoot: '/fake/project1' }])
  })

  it('excludes a db written to during or after the scan, even with matching sessionIds', () => {
    const dbPath = '/fake/project/.crush/crush.db'
    const sessions = [makeSession('ses_1')]
    const discoveries = [makeDiscovery(dbPath, ['ses_1'])]

    const candidates = computeCrushRotationCandidates(sessions, discoveries, {
      asOfMs: scanStartedAtMs,
      _statFn: () => ({ mtimeMs: scanStartedAtMs + 1 })
    })
    expect(candidates).toEqual([])
  })

  it('excludes a db whose mtime cannot be read', () => {
    const dbPath = '/fake/project/.crush/crush.db'
    const sessions = [makeSession('ses_1')]
    const discoveries = [makeDiscovery(dbPath, ['ses_1'])]

    const candidates = computeCrushRotationCandidates(sessions, discoveries, {
      asOfMs: scanStartedAtMs,
      _statFn: () => {
        throw new Error('ENOENT')
      }
    })
    expect(candidates).toEqual([])
  })
})

describe('rotation concurrency', () => {
  it('skips rotation with issue when Crush holds the database open', async () => {
    const projectRoot = createTempDir()
    const dbPath = createCrushDbWithSiblings(projectRoot)
    const mockExec = makeMockExecFn({
      tasklistOutput: '"crush.exe","1234","Console","1","100,000 K"',
      powershellOutput: `crush --project ${projectRoot}`
    })

    const result = await rotateCrushDatabase(dbPath, projectRoot, {
      platform: 'win32',
      _execFn: mockExec
    })

    expect(result.backupPath).toBeNull()
    expect(existsSync(dbPath)).toBe(true)
    expect(existsSync(`${dbPath}-wal`)).toBe(true)
    expect(existsSync(`${dbPath}-shm`)).toBe(true)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].agent).toBe('crush')
    expect(result.issues[0].path).toBe(dbPath)
  })
})
