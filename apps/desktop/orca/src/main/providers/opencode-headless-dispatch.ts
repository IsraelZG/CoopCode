/* eslint-disable max-lines */
// Why: DEVX-044 — opencode's bundled TUI (OpenTUI/bun:ffi renderer) crashes on
// this platform's build, so orchestrated worker-start must dispatch opencode
// headlessly: one `opencode serve` per worktree + `opencode run --attach`.
// This module owns serve lifecycle (start/reuse, bounded health retry), the
// attach-run command, the dispatch prompt file, session visibility wait, and
// restricted agent profile creation/verification.
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

// Why: Electron is referenced lazily (never a static import) so this module's
// pure-node unit tests can import it without a missing 'electron' module at load,
// while the real packaged Electron main process still resolves
// process.resourcesPath and app.getPath('exe') exactly like
// resolveAgentBrowserBinary() does for agent-browser.
type ElectronAppLike = { getPath: (name: string) => string; getAppPath?: () => string }
type ElectronLike = { app?: ElectronAppLike }

let cachedElectronModule: ElectronLike | null | undefined
function electronRef(): ElectronLike | null {
  if (cachedElectronModule !== undefined) {
    return cachedElectronModule
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('electron') as unknown
    cachedElectronModule =
      mod && typeof mod === 'object' ? (mod as ElectronLike) : null
  } catch {
    cachedElectronModule = null
  }
  return cachedElectronModule
}

// Why: the vendored binary lives under `dist/opencode-<platform>-<arch>/` where
// the platform folder is spelled "windows" (not node's "win32"), matching what
// tools/build-coopcode.ps1 already assumes for the arm64 build.
function openCodePlatformName(): string {
  return process.platform === 'win32' ? 'windows' : process.platform
}

function openCodeNativeName(): string {
  return process.platform === 'win32' ? 'opencode.exe' : 'opencode'
}

// Why: dev/unpackaged runs have no resources bundle, so fall back to the vendored
// binary that tools/build-coopcode.ps1 copies from external_repos (a sibling of the
// repo root). Mirror the script's discovery: walk repo-root candidates and their
// parent dirs for an `external_repos/opencode/...` tree.
function openCodeDevVendoredBinary(): string | null {
  const roots: string[] = []
  try {
    roots.push(process.cwd())
  } catch {
    // ignore
  }
  const app = electronRef()?.app
  if (app?.getAppPath) {
    try {
      roots.push(app.getAppPath())
    } catch {
      // ignore
    }
  }
  const relative = [
    'external_repos',
    'opencode',
    'packages',
    'opencode',
    'dist',
    `opencode-${openCodePlatformName()}-${process.arch}`,
    'bin',
    openCodeNativeName()
  ]
  for (const base of roots) {
    for (const dir of [base, dirname(base)]) {
      if (!dir) {
        continue
      }
      try {
        const candidate = join(dir, ...relative)
        if (existsSync(candidate)) {
          return candidate
        }
      } catch {
        // ignore
      }
    }
  }
  return null
}

/**
 * Resolves the opencode binary the same way `resolveAgentBrowserBinary()` resolves
 * agent-browser: the packaged bundle first (process.resourcesPath, with the
 * platform-specific `app.getPath('exe')` fallback), then the dev-mode vendored
 * binary under external_repos, then a bare PATH lookup as the last resort.
 */
export function resolveOpenCodeBinary(): string {
  let resourcesPath = process.resourcesPath
  if (!resourcesPath) {
    const app = electronRef()?.app
    if (app) {
      try {
        resourcesPath =
          process.platform === 'darwin'
            ? join(app.getPath('exe'), '..', '..', 'Resources')
            : join(app.getPath('exe'), '..', 'resources')
      } catch {
        resourcesPath = undefined
      }
    }
  }
  if (resourcesPath) {
    const bundled = join(resourcesPath, openCodeNativeName())
    if (existsSync(bundled)) {
      return bundled
    }
  }
  const devVendored = openCodeDevVendoredBinary()
  if (devVendored) {
    return devVendored
  }
  return 'opencode'
}

export const OPENCODE_PERMISSION_KEYS = [
  'bash',
  'read',
  'edit',
  'glob',
  'grep',
  'webfetch',
  'task',
  'todowrite',
  'websearch',
  'lsp',
  'skill'
] as const

export type OpenCodePermission = (typeof OPENCODE_PERMISSION_KEYS)[number]

// Why: ports are derived from a worktree-hash inside this range so a serve that
// survives an Orca restart is found again by the next dispatch on the same
// worktree (the "attach to an already-running serve" behavior).
export const OPENCODE_SERVE_PORT_RANGE_START = 40_000
export const OPENCODE_SERVE_PORT_RANGE_SIZE = 20_000
export const OPENCODE_SERVE_HEALTH_ATTEMPTS = 25
export const OPENCODE_SERVE_HEALTH_INTERVAL_MS = 1_000
export const OPENCODE_SERVE_STARTUP_ATTEMPTS = 2
export const OPENCODE_SERVE_PORT_SCAN = 4
export const OPENCODE_DISPATCH_SESSION_WAIT_TIMEOUT_MS = 60_000
export const OPENCODE_RUN_PROMPT_WAIT_TIMEOUT_MS = 90_000

// Why: the run terminal cannot hand a multi-KB dispatch prompt to `opencode run`
// through PTY stdin (the CLI requires a message argument and blocks on open
// stdin) and embedding it in a shell command is fragile across cmd/PowerShell/
// bash. This runner is written to the OS temp dir at dispatch time and spawned
// as `node <runner> --url <url> --title <id> [--agent <profile>]
// [--binary <path>] --prompt <file> --wait-ms <n>`; it waits for the prompt file
// (written after the dispatch authority is prepared), then spawns
// `opencode run --attach ... --auto` with
// the prompt as a real argv element. Embedding the source keeps packaged builds
// self-contained (no extra bundled asset or build-config change).
export const OPENCODE_RUN_RUNNER_SOURCE = `#!/usr/bin/env node
// DEVX-044: spawns \`opencode run --attach <url> --title <title> --auto [--agent <profile>] <prompt>\`
// with the dispatch prompt as a real argv element (no intermediate shell).
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--url' || token === '--title' || token === '--agent' || token === '--binary' || token === '--prompt' || token === '--wait-ms') {
      args[token.slice(2)] = argv[i + 1]
      i += 1
    }
  }
  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForPromptFile(file, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      return readFileSync(file, 'utf8')
    }
    await sleep(250)
  }
  throw new Error(\`opencode dispatch prompt file \${file} never appeared within \${timeoutMs}ms\`)
}

async function main() {
  const { url, title, agent, binary, prompt, 'wait-ms': waitMs } = parseArgs(process.argv.slice(2))
  if (!url || !title || !prompt) {
    process.stderr.write('usage: opencode-headless-dispatch-runner.mjs --url <server-url> --title <title> [--agent <profile>] [--binary <path>] --prompt <prompt-file> [--wait-ms <ms>]\\n')
    process.exit(2)
  }
  const promptText = await waitForPromptFile(prompt, Number(waitMs) || 90000)
  const opencodeArgs = ['run', '--attach', url, '--title', title]
  if (agent) {
    opencodeArgs.push('--agent', agent)
  }
  opencodeArgs.push('--auto', promptText)

  const child = spawn(binary || 'opencode', opencodeArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env
  })
  child.once('error', (error) => {
    process.stderr.write(\`Failed to spawn opencode: \${error.message}\\n\`)
    process.exit(1)
  })
  child.once('exit', (code) => {
    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  process.stderr.write(\`\${error?.message ?? error}\\n\`)
  process.exit(1)
})
`

export type OpenCodeServeHandle = {
  url: string
  port: number
  worktreeId: string
  worktreeDir: string
  reused: boolean
  proc: ChildProcess | null
  startedAt: number
}

export type OpenCodeHeadlessDispatchErrorCode =
  | 'serve_startup_failed'
  | 'dispatch_session_timeout'
  | 'agent_profile_invalid'
  | 'invalid_permissions'

export class OpenCodeHeadlessDispatchError extends Error {
  constructor(
    readonly code: OpenCodeHeadlessDispatchErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'OpenCodeHeadlessDispatchError'
  }
}

// Why: in-memory registry of serves started by this process; cross-restart reuse
// relies on the deterministic port + health/ownership probe instead.
const openCodeServes = new Map<string, OpenCodeServeHandle>()

function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch
): Promise<{ ok: boolean; body: unknown }> {
  try {
    const response = await fetchImpl(url)
    const text = await response.text()
    let body: unknown = null
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    return { ok: response.ok, body }
  } catch {
    return { ok: false, body: null }
  }
}

export async function isOpenCodeServeHealthy(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const { ok, body } = await fetchJson(`${url}/global/health`, fetchImpl)
  if (!ok) {
    return false
  }
  return typeof body === 'object' && body !== null && (body as { healthy?: unknown }).healthy === true
}

export async function listOpenCodeServeSessions(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ id?: string; title?: string; directory?: string }[]> {
  const { ok, body } = await fetchJson(`${url}/session`, fetchImpl)
  if (!ok || !Array.isArray(body)) {
    return []
  }
  return body as { id?: string; title?: string; directory?: string }[]
}

function normalizeWorktreeDirForCompare(worktreeDir: string): string {
  return process.platform === 'win32' ? worktreeDir.toLowerCase().replaceAll('/', '\\') : worktreeDir
}

export async function openCodeServeOwnsWorktree(
  url: string,
  worktreeDir: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const sessions = await listOpenCodeServeSessions(url, fetchImpl)
  if (sessions.length === 0) {
    // Why: a fresh server on this worktree's deterministic port has no sessions
    // yet; it is still ours (only this module starts serves on hashed ports).
    return true
  }
  const normalized = normalizeWorktreeDirForCompare(worktreeDir)
  return sessions.some((session) => {
    if (!session.directory) {
      return false
    }
    return normalizeWorktreeDirForCompare(session.directory) === normalized
  })
}

export function pickOpenCodeServePort(worktreeId: string): number {
  return OPENCODE_SERVE_PORT_RANGE_START + (fnv1a(worktreeId) % OPENCODE_SERVE_PORT_RANGE_SIZE)
}

function registerServe(handle: OpenCodeServeHandle): OpenCodeServeHandle {
  openCodeServes.set(handle.worktreeId, handle)
  handle.proc?.once('exit', () => {
    if (openCodeServes.get(handle.worktreeId) === handle) {
      openCodeServes.delete(handle.worktreeId)
    }
  })
  return handle
}

export function resetOpenCodeServeRegistry(): void {
  openCodeServes.clear()
}

export function getOpenCodeServeForWorktree(worktreeId: string): OpenCodeServeHandle | undefined {
  return openCodeServes.get(worktreeId)
}

/**
 * Starts (or reuses) a healthy `opencode serve` bound to the dispatch worktree.
 *
 * A single failed bootstrap attempt must not be fatal: the health check keeps
 * polling while the process lives, and a process that exits before becoming
 * healthy is respawned (up to `startupAttempts` per port). Bounded end to end.
 */
export async function startOrReuseOpenCodeServe(args: {
  worktreeId: string
  worktreeDir: string
  binary?: string
  healthAttempts?: number
  healthIntervalMs?: number
  startupAttempts?: number
  portScan?: number
  fetchImpl?: typeof fetch
  spawnImpl?: typeof spawn
}): Promise<OpenCodeServeHandle> {
  const registered = openCodeServes.get(args.worktreeId)
  if (registered) {
    const healthy = await isOpenCodeServeHealthy(registered.url, args.fetchImpl ?? fetch)
    if (healthy) {
      return registered
    }
    openCodeServes.delete(args.worktreeId)
    registered.proc?.kill()
  }

  const binary = args.binary ?? resolveOpenCodeBinary()
  const healthAttempts = args.healthAttempts ?? OPENCODE_SERVE_HEALTH_ATTEMPTS
  const healthIntervalMs = args.healthIntervalMs ?? OPENCODE_SERVE_HEALTH_INTERVAL_MS
  const startupAttempts = args.startupAttempts ?? OPENCODE_SERVE_STARTUP_ATTEMPTS
  const portScan = args.portScan ?? OPENCODE_SERVE_PORT_SCAN
  const spawnImpl = args.spawnImpl ?? spawn
  const fetchImpl = args.fetchImpl ?? fetch
  const basePort = pickOpenCodeServePort(args.worktreeId)

  for (let scan = 0; scan < portScan; scan += 1) {
    const port = basePort + scan
    const url = `http://127.0.0.1:${port}`
    if (await isOpenCodeServeHealthy(url, fetchImpl)) {
      if (await openCodeServeOwnsWorktree(url, args.worktreeDir, fetchImpl)) {
        return registerServe({
          url,
          port,
          worktreeId: args.worktreeId,
          worktreeDir: args.worktreeDir,
          reused: true,
          proc: null,
          startedAt: Date.now()
        })
      }
      continue
    }

    let lastSpawnError: Error | null = null
    for (let attempt = 0; attempt < startupAttempts; attempt += 1) {
      let proc: ChildProcess | null = null
      try {
        proc = spawnImpl(binary, ['serve', '--port', String(port)], {
          cwd: args.worktreeDir,
          stdio: ['ignore', 'ignore', 'ignore']
        })
      } catch (error) {
        lastSpawnError = error instanceof Error ? error : new Error(String(error))
        break
      }
      let exited = false
      proc.once('exit', () => {
        exited = true
      })
      for (let poll = 0; poll < healthAttempts; poll += 1) {
        if (await isOpenCodeServeHealthy(url, fetchImpl)) {
          return registerServe({
            url,
            port,
            worktreeId: args.worktreeId,
            worktreeDir: args.worktreeDir,
            reused: false,
            proc,
            startedAt: Date.now()
          })
        }
        if (exited) {
          break
        }
        await sleep(healthIntervalMs)
      }
      proc.kill()
      if (!exited) {
        break
      }
    }
    if (lastSpawnError) {
      // Why: an unavailable binary (ENOENT) is not a port problem; report it.
      throw new OpenCodeHeadlessDispatchError(
        'serve_startup_failed',
        `Failed to spawn "${binary} serve": ${lastSpawnError.message}`
      )
    }
  }

  throw new OpenCodeHeadlessDispatchError(
    'serve_startup_failed',
    `opencode serve for ${args.worktreeId} did not become healthy after ${portScan} ports x ${startupAttempts} attempts x ${healthAttempts} polls.`
  )
}

/**
 * Waits until the server reports a session whose title matches the dispatch id,
 * proving the `opencode run --attach --title <dispatchId>` session is real and
 * live from the moment it starts.
 */
export async function waitForOpenCodeDispatchSession(args: {
  url: string
  title: string
  timeoutMs?: number
  pollIntervalMs?: number
  fetchImpl?: typeof fetch
}): Promise<{ sessionId: string }> {
  const timeoutMs = args.timeoutMs ?? OPENCODE_DISPATCH_SESSION_WAIT_TIMEOUT_MS
  const pollIntervalMs = args.pollIntervalMs ?? 1_000
  const fetchImpl = args.fetchImpl ?? fetch
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const sessions = await listOpenCodeServeSessions(args.url, fetchImpl)
    const match = sessions.find((session) => session.title === args.title && session.id)
    if (match?.id) {
      return { sessionId: match.id }
    }
    await sleep(pollIntervalMs)
  }
  throw new OpenCodeHeadlessDispatchError(
    'dispatch_session_timeout',
    `No opencode session titled "${args.title}" appeared on ${args.url} within ${timeoutMs}ms.`
  )
}

export function sanitizeOpenCodeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_')
}

/**
 * Writes the attach-runner script to the OS temp dir for one dispatch and
 * returns its path. The terminal command then runs `node <path>` with plain
 * quoted args, which every Windows/Unix shell delivery path accepts.
 */
export function prepareOpenCodeRunRunner(
  dispatchId: string,
  dir?: string
): string {
  const target = join(
    dir ?? tmpdir(),
    `orca-opencode-runner-${sanitizeOpenCodeFileName(dispatchId)}.mjs`
  )
  writeFileSync(target, OPENCODE_RUN_RUNNER_SOURCE, 'utf8')
  return target
}

/**
 * The prompt file path for a dispatch. The runner blocks until this file
 * exists, so callers must not create it before the real prompt is ready.
 */
export function getOpenCodeDispatchPromptFilePath(dispatchId: string, dir?: string): string {
  return join(dir ?? tmpdir(), `orca-opencode-dispatch-${sanitizeOpenCodeFileName(dispatchId)}.txt`)
}

/**
 * Persists the dispatch preamble + task spec so the run terminal can hand it to
 * `opencode run --attach` as an argv message (PTY stdin cannot carry it: the
 * CLI requires a message argument and blocks on open stdin).
 */
export function writeOpenCodeDispatchPromptFile(args: {
  dispatchId: string
  prompt: string
  dir?: string
}): string {
  const file = getOpenCodeDispatchPromptFilePath(args.dispatchId, args.dir)
  writeFileSync(file, args.prompt, 'utf8')
  return file
}

/**
 * Builds the terminal command that runs the attach-runner. The command is short
 * and quote-wrapped so every Windows/Unix shell delivery path (PowerShell
 * -EncodedCommand, cmd.exe stdin, bash) accepts it; the runner itself spawns
 * `opencode run` directly with a proper argv so no multi-KB prompt ever has to
 * survive shell quoting.
 */
// Why: the `--binary` argument threads the resolved packaged/dev binary into the
// detached runner, so the spawned `node <runner>` never depends on opencode being
// on the daemon's PATH (the exact failure that blocked DEVX-049 criteria 1-4).
export function buildOpenCodeRunTerminalCommand(args: {
  runnerPath: string
  url: string
  title: string
  agentProfile?: string
  binary?: string
  promptFile: string
  promptWaitMs?: number
}): string {
  const wait = args.promptWaitMs ?? OPENCODE_RUN_PROMPT_WAIT_TIMEOUT_MS
  const parts = [
    'node',
    `"${args.runnerPath}"`,
    '--url',
    `"${args.url}"`,
    '--title',
    `"${args.title}"`,
    '--prompt',
    `"${args.promptFile}"`,
    '--wait-ms',
    String(wait)
  ]
  if (args.agentProfile) {
    parts.push('--agent', `"${args.agentProfile}"`)
  }
  parts.push('--binary', `"${args.binary ?? resolveOpenCodeBinary()}"`)
  return parts.join(' ')
}

export function normalizeOpenCodePermissions(value: string): OpenCodePermission[] {
  const requested = value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  const unknown = requested.filter((key) => !(OPENCODE_PERMISSION_KEYS as readonly string[]).includes(key))
  if (unknown.length > 0) {
    throw new OpenCodeHeadlessDispatchError(
      'invalid_permissions',
      `Unknown opencode permission(s): ${unknown.join(', ')}. Valid: ${OPENCODE_PERMISSION_KEYS.join(', ')}`
    )
  }
  return [...new Set(requested)] as OpenCodePermission[]
}

function parseOpenCodeAgentFrontmatter(content: string): {
  mode?: string
  permissions: Map<string, string>
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const permissions = new Map<string, string>()
  let mode: string | undefined
  const raw = match?.[1] ?? ''
  const modeMatch = raw.match(/^\s*mode:\s*(\S+)\s*$/m)
  if (modeMatch) {
    mode = modeMatch[1]
  }
  const multiline = raw.match(/^\s*permission:\s*\r?\n((?:[ \t]+[A-Za-z_*]+:\s*\S+[ \t]*\r?\n?)+)/m)
  const inline = raw.match(/^\s*permission:\s*((?:[A-Za-z_*]+:\s*\S+\s*,?\s*)+)[\r\n]?/m)
  const section = (multiline?.[1] ?? inline?.[1] ?? '').split('\n')
  for (const line of section) {
    const entry = line.match(/^\s*([A-Za-z_*]+):\s*(\S+)\s*$/)
    if (entry) {
      permissions.set(entry[1], entry[2])
    } else {
      for (const token of line.split(',')) {
        const inlineEntry = token.trim().match(/^([A-Za-z_*]+):\s*(\S+)$/)
        if (inlineEntry) {
          permissions.set(inlineEntry[1], inlineEntry[2])
        }
      }
    }
  }
  return { mode, permissions }
}

/**
 * Verifies a generated agent file grants exactly the requested permissions:
 * every requested key must not be denied, and every non-requested permission
 * must be denied (so a read-mostly request cannot silently keep bash/webfetch).
 */
export function openCodeAgentFileMatchesPermissions(
  content: string,
  permissions: OpenCodePermission[]
): boolean {
  const { permissions: rules } = parseOpenCodeAgentFrontmatter(content)
  for (const key of OPENCODE_PERMISSION_KEYS) {
    const rule = rules.get(key)
    if (permissions.includes(key)) {
      if (rule === 'deny') {
        return false
      }
    } else if (rule !== 'deny') {
      return false
    }
  }
  return true
}

/**
 * Builds (or reuses) a restricted opencode agent profile via
 * `opencode agent create --mode subagent --permissions <csv>`, then makes it
 * usable for `opencode run --agent <name>`: this build's run command rejects
 * subagents ("is a subagent, not a primary agent"), so the generated file is
 * moved to the worktree's `.opencode/agents/<profile>.md` and rewritten to
 * `mode: primary` with the exact same permission map. The permission map is
 * verified after generation and again after the rewrite. A generated file that
 * already exists (from a previously accepted attempt) is verified and reused.
 */
export async function ensureOpenCodeAgentProfile(args: {
  profile: string
  permissions: OpenCodePermission[]
  worktreeDir: string
  binary?: string
  createRetries?: number
  fetchImpl?: typeof fetch
  spawnImpl?: typeof spawn
}): Promise<{ profile: string; permissions: OpenCodePermission[]; file: string }> {
  const profile = sanitizeOpenCodeFileName(args.profile)
  if (!profile) {
    throw new OpenCodeHeadlessDispatchError('agent_profile_invalid', 'An opencode agent profile name is required.')
  }
  const binary = args.binary ?? resolveOpenCodeBinary()
  const createRetries = args.createRetries ?? 1
  const spawnImpl = args.spawnImpl ?? spawn
  const targetFile = join(args.worktreeDir, '.opencode', 'agents', `${profile}.md`)
  if (existsSync(targetFile)) {
    const existing = readFileSync(targetFile, 'utf8')
    if (openCodeAgentFileMatchesPermissions(existing, args.permissions)) {
      return { profile, permissions: args.permissions, file: targetFile }
    }
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= createRetries; attempt += 1) {
    try {
      const result = await runOpenCodeAgentCreate({
        binary,
        worktreeDir: args.worktreeDir,
        description: profile,
        permissions: args.permissions,
        spawnImpl
      })
      const { generatedFile, content } = result
      if (!openCodeAgentFileMatchesPermissions(content, args.permissions)) {
        throw new OpenCodeHeadlessDispatchError(
          'agent_profile_invalid',
          `Generated opencode agent ${profile} does not grant exactly: ${args.permissions.join(', ')}.`
        )
      }
      mkdirSync(dirname(targetFile), { recursive: true })
      const rewritten = rewriteAgentModePrimary(content)
      if (!openCodeAgentFileMatchesPermissions(rewritten, args.permissions)) {
        throw new OpenCodeHeadlessDispatchError(
          'agent_profile_invalid',
          `Rewritten opencode agent ${profile} lost the requested permission map.`
        )
      }
      writeFileSync(targetFile, rewritten, 'utf8')
      if (generatedFile !== targetFile) {
        rmSync(generatedFile, { force: true })
      }
      return { profile, permissions: args.permissions, file: targetFile }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }
  throw new OpenCodeHeadlessDispatchError(
    'agent_profile_invalid',
    `Failed to create restricted opencode agent "${profile}": ${lastError?.message ?? 'unknown error'}`
  )
}

async function runOpenCodeAgentCreate(args: {
  binary: string
  worktreeDir: string
  description: string
  permissions: OpenCodePermission[]
  spawnImpl: typeof spawn
}): Promise<{ generatedFile: string; content: string }> {
  return await new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let child: ChildProcess
    try {
      child = args.spawnImpl(
        args.binary,
        [
          'agent',
          'create',
          // Why: `--path <dir>` writes to `<dir>/agents/<name>.md`; pointing at
          // the worktree's .opencode dir keeps generation inside opencode's own
          // per-project discovery location instead of polluting `agents/` at the
          // worktree root.
          '--path',
          join(args.worktreeDir, '.opencode'),
          '--description',
          args.description,
          '--mode',
          'subagent',
          '--permissions',
          args.permissions.join(',')
        ],
        { cwd: args.worktreeDir, stdio: ['ignore', 'pipe', 'pipe'] }
      )
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)))
      return
    }
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      const generatedFile = parseGeneratedAgentFile(`${stdout}\n${stderr}`, args.worktreeDir)
      if (code !== 0) {
        // Why: a previous accepted attempt may already have generated the file
        // (the create is LLM-driven and slow; the RPC client can time out while
        // the server finishes). Verify and reuse that artifact instead of
        // failing the whole dispatch on a retry.
        if (generatedFile && existsSync(generatedFile)) {
          resolve({ generatedFile, content: readFileSync(generatedFile, 'utf8') })
          return
        }
        reject(new Error(`opencode agent create exited ${code}: ${stderr.trim() || stdout.trim()}`))
        return
      }
      if (!generatedFile) {
        reject(
          new Error(
            `opencode agent create output did not name a generated agent file: ${stdout.trim().slice(0, 300)}`
          )
        )
        return
      }
      if (!existsSync(generatedFile)) {
        reject(new Error(`opencode agent create reported ${generatedFile} but it does not exist.`))
        return
      }
      resolve({ generatedFile, content: readFileSync(generatedFile, 'utf8') })
    })
  })
}

function parseGeneratedAgentFile(stdout: string, cwd: string): string | null {
  const candidates = stdout.split(/\r?\n/).map((line) => line.trim())
  const abs = candidates.find((line) => /\.md$/i.test(line) && /^[A-Za-z]:[\\/]/.test(line))
  if (abs) {
    return abs
  }
  const embeddedAbs = stdout.match(/[A-Za-z]:[\\/][^\r\n]*?\.md(?=\s|$)/i)?.[0]
  if (embeddedAbs) {
    return embeddedAbs
  }
  const relative = candidates.find((line) => /\.md$/i.test(line))
  return relative ? join(cwd, relative) : null
}

function rewriteAgentModePrimary(content: string): string {
  return content.replace(/^mode:\s*subagent\s*$/m, 'mode: primary')
}

export function removeOpenCodeDispatchPromptFile(file: string): void {
  try {
    rmSync(file, { force: true })
  } catch {
    // Best-effort cleanup; the file lives under the OS temp dir.
  }
}
