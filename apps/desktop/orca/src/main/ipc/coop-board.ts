import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { ipcMain } from 'electron'
import { gitExecFileAsync } from '../git/runner'


export type CoopTaskState = 'draft' | 'ready' | 'working' | 'review' | 'done' | 'blocked'

export type CoopTaskIntegration = {
  reviewDecision?: string
  resultSha?: string
  mergeCommit?: string
}

export type CoopBoardTask = {
  id: string
  title: string
  state: CoopTaskState
  frontmatterState: CoopTaskState
  priority: string
  risk: string
  dependsOn: string[]
  blockedOn: string[]
  blocked: boolean
  blockingReasons: string[]
  worktreePath?: string
  branch?: string
  integration?: CoopTaskIntegration
}

export type CoopBoardResult = {
  repoRoot: string
  tasks: CoopBoardTask[]
  error?: string
}

type CoopTaskFrontmatter = {
  id?: unknown
  title?: unknown
  state?: unknown
  priority?: unknown
  risk?: unknown
  depends_on?: unknown
  blocked_on?: unknown
}

type WorktreeRecord = {
  worktreePath?: string
  branch?: string
}

type LoadCoopBoardOptions = {
  repoRoot: string
  worktreePorcelain?: string
}

const TASK_STATE_VALUES = new Set(['draft', 'ready', 'working', 'review', 'done', 'blocked'])

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asTaskState(value: unknown): CoopTaskState {
  return typeof value === 'string' && TASK_STATE_VALUES.has(value) ? (value as CoopTaskState) : 'draft'
}

function parseFrontmatter(text: string): CoopTaskFrontmatter {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) {
    throw new Error('Task file is missing frontmatter')
  }
  return JSON.parse(match[1]) as CoopTaskFrontmatter
}

function cleanIntegrationValue(value: string): string {
  return value.trim().replace(/^`|`$/g, '')
}

function parseIntegration(text: string): CoopTaskIntegration | undefined {
  const marker = '## Integration'
  const markerIndex = text.lastIndexOf(marker)
  if (markerIndex === -1) {
    return undefined
  }
  const section = text.slice(markerIndex + marker.length)
  const reviewDecision = section.match(/Review decision:\s*([^\r\n]+)/)
  const resultSha = section.match(/Result SHA:\s*([^\r\n]+)/)
  const mergeCommit = section.match(/Merge commit:\s*([^\r\n]+)/)
  const integration: CoopTaskIntegration = {}
  if (reviewDecision) {
    integration.reviewDecision = cleanIntegrationValue(reviewDecision[1])
  }
  if (resultSha) {
    integration.resultSha = cleanIntegrationValue(resultSha[1])
  }
  if (mergeCommit) {
    integration.mergeCommit = cleanIntegrationValue(mergeCommit[1])
  }
  return Object.keys(integration).length > 0 ? integration : undefined
}

function parseWorktreePorcelain(porcelain: string): WorktreeRecord[] {
  const records: WorktreeRecord[] = []
  let current: WorktreeRecord | null = null
  for (const line of porcelain.split(/\r?\n/)) {
    if (!line.trim()) {
      if (current) {
        records.push(current)
        current = null
      }
      continue
    }
    if (line.startsWith('worktree ')) {
      if (current) {
        records.push(current)
      }
      current = { worktreePath: line.slice('worktree '.length) }
      continue
    }
    if (line.startsWith('branch ') && current) {
      current.branch = line.slice('branch '.length)
    }
  }
  if (current) {
    records.push(current)
  }
  return records
}

async function getWorktreePorcelain(repoRoot: string): Promise<string> {
  try {
    const { stdout } = await gitExecFileAsync(['worktree', 'list', '--porcelain'], { cwd: repoRoot })
    return stdout
  } catch (err) {
    const text = err instanceof Error ? err.message : ''
    throw new Error(text || 'git worktree list failed')
  }
}

function worktreeByTaskId(records: WorktreeRecord[]): Map<string, WorktreeRecord> {
  const byTaskId = new Map<string, WorktreeRecord>()
  for (const record of records) {
    const branch = record.branch ?? ''
    // Why: prepare-task.mjs creates task/<id-lowercase> for any task id shape (DEVX-040, PLAT-013), not just devx-N.
    const match = branch.match(/^refs\/heads\/task\/(.+)$/)
    if (match) {
      byTaskId.set(match[1].toUpperCase(), record)
    }
  }
  return byTaskId
}

function compareTaskIds(a: string, b: string): number {
  const aNumber = Number(a.match(/\d+$/)?.[0] ?? Number.NaN)
  const bNumber = Number(b.match(/\d+$/)?.[0] ?? Number.NaN)
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) {
    return aNumber - bNumber
  }
  return a.localeCompare(b)
}

function computeBlocking(tasks: CoopBoardTask[]): CoopBoardTask[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  return tasks.map((task) => {
    const reasons: string[] = []
    for (const dependencyId of task.dependsOn) {
      const dependency = byId.get(dependencyId)
      if (!dependency) {
        reasons.push(`Missing dependency ${dependencyId}`)
      } else if (dependency.state !== 'done') {
        reasons.push(`${dependencyId} is ${dependency.state}`)
      }
    }
    for (const externalBlock of task.blockedOn) {
      reasons.push(externalBlock)
    }
    return {
      ...task,
      blocked: reasons.length > 0,
      blockingReasons: reasons
    }
  })
}

async function readTaskFile(taskPath: string, liveWorktrees: Map<string, WorktreeRecord>): Promise<CoopBoardTask> {
  const text = await readFile(taskPath, 'utf8')
  const frontmatter = parseFrontmatter(text)
  const id = asString(frontmatter.id)
  const frontmatterState = asTaskState(frontmatter.state)
  const liveWorktree = liveWorktrees.get(id)
  const state = frontmatterState !== 'done' && liveWorktree ? 'working' : frontmatterState
  return {
    id,
    title: asString(frontmatter.title),
    state,
    frontmatterState,
    priority: asString(frontmatter.priority),
    risk: asString(frontmatter.risk),
    dependsOn: asStringArray(frontmatter.depends_on),
    blockedOn: asStringArray(frontmatter.blocked_on),
    blocked: false,
    blockingReasons: [],
    worktreePath: liveWorktree?.worktreePath,
    branch: liveWorktree?.branch,
    integration: parseIntegration(text)
  }
}

export async function loadCoopBoard(options: LoadCoopBoardOptions): Promise<CoopBoardResult> {
  const repoRoot = path.resolve(options.repoRoot)
  const tasksRoot = path.join(repoRoot, 'docs', 'coop', 'tasks')
  const porcelain = options.worktreePorcelain ?? (await getWorktreePorcelain(repoRoot))
  const liveWorktrees = worktreeByTaskId(parseWorktreePorcelain(porcelain))
  const entries = await readdir(tasksRoot, { withFileTypes: true })
  const taskFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(tasksRoot, entry.name))
  const tasks = await Promise.all(taskFiles.map((taskPath) => readTaskFile(taskPath, liveWorktrees)))
  tasks.sort((a, b) => compareTaskIds(a.id, b.id))
  return {
    repoRoot,
    tasks: computeBlocking(tasks)
  }
}

export function registerCoopBoardHandlers(): void {
  ipcMain.handle('coopBoard:listTasks', async (_event, args: { repoRoot?: unknown }) => {
    if (typeof args?.repoRoot !== 'string' || !args.repoRoot.trim()) {
      return { repoRoot: '', tasks: [], error: 'repoRoot is required' } satisfies CoopBoardResult
    }
    try {
      return await loadCoopBoard({ repoRoot: args.repoRoot })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { repoRoot: args.repoRoot, tasks: [], error: message } satisfies CoopBoardResult
    }
  })
}
