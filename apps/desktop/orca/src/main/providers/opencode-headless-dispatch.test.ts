import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { EventEmitter } from 'node:events'
import type { spawn } from 'node:child_process'
import {
  OpenCodeHeadlessDispatchError,
  OPENCODE_RUN_RUNNER_SOURCE,
  buildOpenCodeRunTerminalCommand,
  ensureOpenCodeAgentProfile,
  normalizeOpenCodePermissions,
  openCodeAgentFileMatchesPermissions,
  pickOpenCodeServePort,
  prepareOpenCodeRunRunner,
  resetOpenCodeServeRegistry,
  resolveOpenCodeBinary,
  sanitizeOpenCodeFileName,
  startOrReuseOpenCodeServe,
  waitForOpenCodeDispatchSession,
  writeOpenCodeDispatchPromptFile
} from './opencode-headless-dispatch'

type FakeProc = EventEmitter & {
  stdout: EventEmitter
  stderr: EventEmitter
  kill: ReturnType<typeof vi.fn>
}

function fakeSpawnProc(): FakeProc {
  const proc = new EventEmitter() as FakeProc
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  return proc
}

function healthyFetch(body: unknown = { healthy: true }) {
  return vi.fn(async () => ({ ok: true, text: async () => JSON.stringify(body) }))
}

function sessionFetch(sessions: { id: string; title: string; directory?: string }[]) {
  return vi.fn(async (url: string) => {
    if (url.endsWith('/global/health')) {
      return { ok: true, text: async () => '{"healthy":true}' }
    }
    if (url.endsWith('/session')) {
      return { ok: true, text: async () => JSON.stringify(sessions) }
    }
    return { ok: false, text: async () => '' }
  })
}

function asFetch(mock: ReturnType<typeof vi.fn>): typeof fetch {
  return mock as unknown as typeof fetch
}

function asSpawn(mock: ReturnType<typeof vi.fn>): typeof spawn {
  return mock as unknown as typeof spawn
}

const ORCA_AGENT_HEADLESS =
  '---\n' +
  'description: read-mostly profile\n' +
  'mode: subagent\n' +
  'permission:\n' +
  '  bash: deny\n' +
  '  edit: deny\n' +
  '  webfetch: deny\n' +
  '  task: deny\n' +
  '  todowrite: deny\n' +
  '  websearch: deny\n' +
  '  lsp: deny\n' +
  '  skill: deny\n' +
  '---\n' +
  'You are a read-mostly agent.\n'

describe('normalizeOpenCodePermissions', () => {
  it('parses and dedupes a comma-separated allow list', () => {
    expect(normalizeOpenCodePermissions('read, glob, grep, read')).toEqual(['read', 'glob', 'grep'])
  })

  it('rejects unknown permission keys', () => {
    expect(() => normalizeOpenCodePermissions('read,bash,rm -rf')).toThrow(OpenCodeHeadlessDispatchError)
  })
})

describe('pickOpenCodeServePort', () => {
  it('derives a stable in-range port per worktree', () => {
    const a = pickOpenCodeServePort('wt-one')
    const b = pickOpenCodeServePort('wt-two')
    expect(a).toBe(pickOpenCodeServePort('wt-one'))
    expect(a).not.toBe(b)
    expect(a).toBeGreaterThanOrEqual(40_000)
    expect(a).toBeLessThan(60_000)
  })
})

describe('sanitizeOpenCodeFileName', () => {
  it('keeps safe characters and replaces the rest', () => {
    expect(sanitizeOpenCodeFileName('ctx_ab-1.cd')).toBe('ctx_ab-1.cd')
    expect(sanitizeOpenCodeFileName('a/b c:z')).toBe('a_b_c_z')
  })
})

describe('buildOpenCodeRunTerminalCommand', () => {
  it('wraps every token in double quotes and includes --agent when requested', () => {
    const command = buildOpenCodeRunTerminalCommand({
      runnerPath: 'C:/Path With Spaces/runner.mjs',
      url: 'http://127.0.0.1:41001',
      title: 'ctx_dispatch_1',
      agentProfile: 'readonly',
      promptFile: 'C:/Temp/orca-opencode-ctx_1.txt',
      promptWaitMs: 42_000
    })
    expect(command).toContain('"C:/Path With Spaces/runner.mjs"')
    expect(command).toContain('--url "http://127.0.0.1:41001"')
    expect(command).toContain('--title "ctx_dispatch_1"')
    expect(command).toContain('--agent "readonly"')
    expect(command).toContain('--prompt "C:/Temp/orca-opencode-ctx_1.txt"')
    expect(command).toContain('--wait-ms 42000')
  })

  it('omits --agent when no profile is requested', () => {
    const command = buildOpenCodeRunTerminalCommand({
      runnerPath: '/opt/orca/runner.mjs',
      url: 'http://127.0.0.1:41001',
      title: 'ctx_x',
      promptFile: '/tmp/orca-prompt.txt'
    })
    expect(command).not.toContain('--agent')
  })
})

describe('writeOpenCodeDispatchPromptFile', () => {
  it('writes the prompt to a dispatch-scoped temp file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-ocd-test-'))
    try {
      const file = writeOpenCodeDispatchPromptFile({
        dispatchId: 'ctx_1.2-3',
        prompt: 'hello world',
        dir
      })
      expect(existsSync(file)).toBe(true)
      expect(readFileSync(file, 'utf8')).toBe('hello world')
      expect(file.endsWith('orca-opencode-dispatch-ctx_1.2-3.txt')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('prepareOpenCodeRunRunner', () => {
  it('writes the embedded runner source to a dispatch-scoped temp file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-ocd-runner-'))
    try {
      const file = prepareOpenCodeRunRunner('ctx_dispatch_7', dir)
      expect(file.endsWith('orca-opencode-runner-ctx_dispatch_7.mjs')).toBe(true)
      expect(existsSync(file)).toBe(true)
      const source = readFileSync(file, 'utf8')
      expect(source).toContain('opencode run --attach')
      expect(source).toBe(OPENCODE_RUN_RUNNER_SOURCE)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('resolveOpenCodeBinary', () => {
  it('returns a usable binary reference (never empty) without throwing in a pure-node test', () => {
    const resolved = resolveOpenCodeBinary()
    expect(typeof resolved).toBe('string')
    expect(resolved.trim().length).toBeGreaterThan(0)
  })

  it('returns a path ending in the platform native name, or the bare name when nothing is bundled', () => {
    const resolved = resolveOpenCodeBinary()
    const native = process.platform === 'win32' ? 'opencode.exe' : 'opencode'
    if (resolved === 'opencode') {
      // Last resort: bare PATH lookup, matching the original default.
      expect(resolved).toBe('opencode')
    } else {
      // Packaged/dev-vendored resolution always points at the native filename.
      expect(resolved.endsWith(native)).toBe(true)
    }
  })

  it('resolves dev-vendored binary under external_repos when present in repository layout', () => {
    const resolved = resolveOpenCodeBinary()
    const native = process.platform === 'win32' ? 'opencode.exe' : 'opencode'
    expect(resolved.endsWith(native)).toBe(true)
    expect(resolved).not.toBe('opencode')
    expect(resolved).toContain('external_repos')
  })
})

describe('openCodeAgentFileMatchesPermissions', () => {
  it('accepts a deny-everything-else map for a read-mostly request', () => {
    expect(openCodeAgentFileMatchesPermissions(ORCA_AGENT_HEADLESS, ['read', 'glob', 'grep'])).toBe(true)
  })

  it('rejects a file that still allows bash for a no-bash request', () => {
    const leaky = ORCA_AGENT_HEADLESS.replace('  bash: deny', '  bash: allow')
    expect(openCodeAgentFileMatchesPermissions(leaky, ['read', 'glob', 'grep'])).toBe(false)
  })

  it('rejects a file that denies a requested permission', () => {
    const deniedRead = ORCA_AGENT_HEADLESS.replace('  bash: deny', '  read: deny')
    expect(openCodeAgentFileMatchesPermissions(deniedRead, ['read', 'glob', 'grep'])).toBe(false)
  })

  it('accepts a real opencode agent create output for a read-mostly profile', () => {
    const capturedCandidate = resolve(
      process.cwd(),
      '..',
      '..',
      '..',
      '.scratch',
      'devx049-live',
      'reverify',
      '.opencode',
      'agents',
      'dx-resolver-auditor.md'
    )
    let real = ''
    if (existsSync(capturedCandidate)) {
      real = readFileSync(capturedCandidate, 'utf8')
    } else {
      real = [
        '---',
        'description: >-',
        '  read-only developer-experience audit agent (captured from real create)',
        'mode: subagent',
        'permission:',
        '  bash: deny',
        '  edit: deny',
        '  webfetch: deny',
        '  task: deny',
        '  todowrite: deny',
        '  websearch: deny',
        '  lsp: deny',
        '  skill: deny',
        '---',
        'You are a read-only agent.'
      ].join('\n')
    }
    expect(openCodeAgentFileMatchesPermissions(real, ['read', 'glob', 'grep'])).toBe(true)
  })
})

describe('startOrReuseOpenCodeServe', () => {
  beforeEach(() => {
    resetOpenCodeServeRegistry()
  })

  it('reuses an already-healthy server that owns the worktree, without spawning', async () => {
    const fetchImpl = sessionFetch([
      { id: 'ses_1', title: 'other', directory: 'C:/Dev2026/worktrees/DEVX-044' }
    ])
    const spawnImpl = vi.fn(fakeSpawnProc)
    const handle = await startOrReuseOpenCodeServe({
      worktreeId: 'wt-reuse',
      worktreeDir: 'C:/Dev2026/worktrees/DEVX-044',
      fetchImpl: asFetch(fetchImpl),
      spawnImpl: asSpawn(spawnImpl)
    })
    expect(handle.reused).toBe(true)
    expect(spawnImpl).not.toHaveBeenCalled()
    expect(handle.url).toBe(`http://127.0.0.1:${pickOpenCodeServePort('wt-reuse')}`)
  })

  it('spawns serve and tolerates a failed first health probe before becoming healthy', async () => {
    let probes = 0
    const fetchImpl = vi.fn(async () => {
      probes += 1
      if (probes <= 2) {
        return { ok: false, text: async () => '' }
      }
      return { ok: true, text: async () => '{"healthy":true}' }
    })
    const spawnImpl = vi.fn(fakeSpawnProc)
    const handle = await startOrReuseOpenCodeServe({
      worktreeId: 'wt-retry',
      worktreeDir: 'C:/repo',
      healthAttempts: 10,
      healthIntervalMs: 1,
      fetchImpl: asFetch(fetchImpl),
      spawnImpl: asSpawn(spawnImpl)
    })
    expect(handle.reused).toBe(false)
    expect(spawnImpl).toHaveBeenCalledTimes(1)
    expect(probes).toBeGreaterThanOrEqual(3)
  })

  it('respawns once when the first serve process exits before becoming healthy', async () => {
    let probes = 0
    // Reuse probe + two polls stay unhealthy so the immediate exit of the first
    // bootstrap attempt is observed between polls; the respawn then succeeds.
    const fetchImpl = vi.fn(async () => {
      probes += 1
      if (probes <= 3) {
        return { ok: false, text: async () => '' }
      }
      return { ok: true, text: async () => '{"healthy":true}' }
    })
    let spawnCalls = 0
    const spawnImpl = vi.fn(() => {
      const proc = fakeSpawnProc()
      spawnCalls += 1
      if (spawnCalls === 1) {
        process.nextTick(() => proc.emit('exit', 1))
      }
      return proc
    })
    const handle = await startOrReuseOpenCodeServe({
      worktreeId: 'wt-respawn',
      worktreeDir: 'C:/repo',
      startupAttempts: 2,
      healthIntervalMs: 1,
      fetchImpl: asFetch(fetchImpl),
      spawnImpl: asSpawn(spawnImpl)
    })
    expect(spawnImpl).toHaveBeenCalledTimes(2)
    expect(handle.url).toContain('127.0.0.1')
  })

  it('throws serve_startup_failed after bounded attempts when health never arrives', async () => {
    const fetchImpl = healthyFetch({ healthy: false })
    const spawnImpl = vi.fn(fakeSpawnProc)
    await expect(
      startOrReuseOpenCodeServe({
        worktreeId: 'wt-fail',
        worktreeDir: 'C:/repo',
        portScan: 2,
        startupAttempts: 2,
        healthAttempts: 3,
        healthIntervalMs: 1,
        fetchImpl: asFetch(fetchImpl),
        spawnImpl: asSpawn(spawnImpl)
      })
    ).rejects.toMatchObject({ code: 'serve_startup_failed' })
    // Bounded: one spawn per scanned port (a live-but-unhealthy process is
    // killed after its poll window; respawn only follows an early exit).
    expect(spawnImpl).toHaveBeenCalledTimes(2)
  })

  it('returns a registered handle for the same worktree without re-probing ownership', async () => {
    let probes = 0
    const fetchImpl = vi.fn(async (url: string) => {
      probes += 1
      if (url.endsWith('/global/health') && probes === 1) {
        return { ok: false, text: async () => '' }
      }
      return { ok: true, text: async () => '{"healthy":true}' }
    })
    const spawnImpl = vi.fn(fakeSpawnProc)
    const first = await startOrReuseOpenCodeServe({
      worktreeId: 'wt-same',
      worktreeDir: 'C:/repo',
      healthAttempts: 3,
      healthIntervalMs: 1,
      fetchImpl: asFetch(fetchImpl),
      spawnImpl: asSpawn(spawnImpl)
    })
    const second = await startOrReuseOpenCodeServe({
      worktreeId: 'wt-same',
      worktreeDir: 'C:/repo',
      fetchImpl: asFetch(fetchImpl),
      spawnImpl: asSpawn(spawnImpl)
    })
    expect(second).toBe(first)
    expect(spawnImpl).toHaveBeenCalledTimes(1)
  })
})

describe('waitForOpenCodeDispatchSession', () => {
  it('resolves once a session with the dispatch title appears', async () => {
    let sessions: { id: string; title: string }[] = []
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/session')) {
        return { ok: true, text: async () => JSON.stringify(sessions) }
      }
      return { ok: false, text: async () => '' }
    })
    const promise = waitForOpenCodeDispatchSession({
      url: 'http://127.0.0.1:41001',
      title: 'ctx_dispatch_9',
      timeoutMs: 2_000,
      pollIntervalMs: 5,
      fetchImpl: asFetch(fetchImpl)
    })
    setTimeout(() => {
      sessions = [{ id: 'ses_live', title: 'ctx_dispatch_9' }]
    }, 20)
    await expect(promise).resolves.toEqual({ sessionId: 'ses_live' })
  })

  it('rejects dispatch_session_timeout when no session ever appears', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, text: async () => '[]' }))
    await expect(
      waitForOpenCodeDispatchSession({
        url: 'http://127.0.0.1:41001',
        title: 'ctx_never',
        timeoutMs: 50,
        pollIntervalMs: 5,
        fetchImpl: asFetch(fetchImpl)
      })
    ).rejects.toMatchObject({ code: 'dispatch_session_timeout' })
  })
})

describe('ensureOpenCodeAgentProfile', () => {
  it('creates via opencode agent create, verifies permissions, and rewrites to primary', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-ocd-profile-'))
    try {
      mkdirSync(join(dir, 'agents'), { recursive: true })
      const generated = join(dir, 'agents', 'llm-name.md')
      writeFileSync(generated, ORCA_AGENT_HEADLESS, 'utf8')
      const spawnImpl = vi.fn(() => {
        const proc = fakeSpawnProc()
        process.nextTick(() => {
          proc.stdout.emit('data', Buffer.from(`Agent llm-name generated\n${generated}\n${generated}\n`))
          proc.emit('exit', 0)
        })
        return proc
      })
      const result = await ensureOpenCodeAgentProfile({
        profile: 'readonly-044',
        permissions: ['read', 'glob', 'grep'],
        worktreeDir: dir,
        spawnImpl: asSpawn(spawnImpl)
      })
      expect(result.profile).toBe('readonly-044')
      const target = join(dir, '.opencode', 'agents', 'readonly-044.md')
      expect(result.file).toBe(target)
      const content = readFileSync(target, 'utf8')
      expect(content).toContain('mode: primary')
      expect(content).not.toContain('mode: subagent')
      expect(openCodeAgentFileMatchesPermissions(content, ['read', 'glob', 'grep'])).toBe(true)
      const args = (spawnImpl.mock.calls[0] ?? []) as unknown as [string, string[]]
      // DEVX-049: the default (no explicit binary) spawns the resolved binary,
      // not a hardcoded bare name — packaged/dev resolution first, PATH last.
      expect(args[0]).toBe(resolveOpenCodeBinary())
      expect(args[1]).toContain('agent')
      expect(args[1]).toContain('create')
      expect(args[1]).toContain('--mode')
      expect(args[1]).toContain('subagent')
      expect(args[1]).toContain('--permissions')
      expect(args[1]).toContain('read,glob,grep')
      // The LLM-named intermediate file is removed after the deterministic move.
      expect(existsSync(generated)).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reuses a generated file when agent create exits non-zero on already-exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-ocd-profile4-'))
    try {
      mkdirSync(join(dir, 'agents'), { recursive: true })
      const generated = join(dir, 'agents', 'reuse-me.md')
      writeFileSync(generated, ORCA_AGENT_HEADLESS, 'utf8')
      const spawnImpl = vi.fn(() => {
        const proc = fakeSpawnProc()
        process.nextTick(() => {
          proc.stderr.emit('data', Buffer.from(`Error: Agent file already exists: ${generated}`))
          proc.emit('exit', 1)
        })
        return proc
      })
      const result = await ensureOpenCodeAgentProfile({
        profile: 'reuse-me',
        permissions: ['read', 'glob', 'grep'],
        worktreeDir: dir,
        spawnImpl: asSpawn(spawnImpl)
      })
      const target = join(dir, '.opencode', 'agents', 'reuse-me.md')
      expect(result.file).toBe(target)
      const content = readFileSync(target, 'utf8')
      expect(content).toContain('mode: primary')
      expect(openCodeAgentFileMatchesPermissions(content, ['read', 'glob', 'grep'])).toBe(true)
      // The LLM-named intermediate file is removed after the deterministic move.
      expect(existsSync(generated)).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reuses an existing file that already matches the requested permissions', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-ocd-profile2-'))
    try {
      mkdirSync(join(dir, '.opencode', 'agents'), { recursive: true })
      const target = join(dir, '.opencode', 'agents', 'readonly.md')
      writeFileSync(target, ORCA_AGENT_HEADLESS.replace('mode: subagent', 'mode: primary'), 'utf8')
      const spawnImpl = vi.fn(fakeSpawnProc)
      const result = await ensureOpenCodeAgentProfile({
        profile: 'readonly',
        permissions: ['read', 'glob', 'grep'],
        worktreeDir: dir,
        spawnImpl: asSpawn(spawnImpl)
      })
      expect(spawnImpl).not.toHaveBeenCalled()
      expect(result.file).toBe(target)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails agent_profile_invalid when the generated file keeps bash allowed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orca-ocd-profile3-'))
    try {
      mkdirSync(join(dir, 'agents'), { recursive: true })
      const generated = join(dir, 'agents', 'bad.md')
      writeFileSync(generated, ORCA_AGENT_HEADLESS.replace('  bash: deny', '  bash: allow'), 'utf8')
      const spawnImpl = vi.fn(() => {
        const proc = fakeSpawnProc()
        process.nextTick(() => {
          proc.stdout.emit('data', Buffer.from(`Agent bad generated\n${generated}\n`))
          proc.emit('exit', 0)
        })
        return proc
      })
      await expect(
        ensureOpenCodeAgentProfile({
          profile: 'bad',
          permissions: ['read', 'glob', 'grep'],
          worktreeDir: dir,
          createRetries: 0,
          spawnImpl: asSpawn(spawnImpl)
        })
      ).rejects.toMatchObject({ code: 'agent_profile_invalid' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
