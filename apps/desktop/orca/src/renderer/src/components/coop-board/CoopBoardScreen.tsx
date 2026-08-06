import { AlertCircle, FileCode, FileText, GitBranch, GitPullRequestArrow, Image as ImageIcon, RefreshCw, Eye, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { isGitRepoKind } from '../../../../shared/repo-kind'

export type CoopTaskState = 'draft' | 'ready' | 'working' | 'review' | 'done' | 'blocked'

export type CoopTaskIntegration = {
  reviewDecision?: string
  resultSha?: string
  mergeCommit?: string
}

export type CoopTaskEvidenceFile = {
  name: string
  relativePath: string
  absolutePath: string
  size: number
  extension: string
  fileType: 'image' | 'text' | 'json' | 'markdown' | 'other'
}

export type CoopTaskAttentionCategory = 'blocked' | 'rework' | 'loop_stop'

export type CoopTaskAttention = {
  needed: boolean
  category?: CoopTaskAttentionCategory
  reason?: string
  stalledAt?: number
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
  evidenceFiles: CoopTaskEvidenceFile[]
  evidenceClaimed: boolean
  evidenceMissing: boolean
  attention?: CoopTaskAttention
  mtimeMs?: number
}

export type CoopBoardResult = {
  repoRoot: string
  tasks: CoopBoardTask[]
  error?: string
}

export const COOP_BOARD_OPEN_EVENT = 'coop-board:open'

const STATE_BADGE_VARIANT: Record<CoopTaskState, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  ready: 'secondary',
  working: 'default',
  review: 'secondary',
  done: 'outline',
  blocked: 'destructive'
}

const RISK_RANK: Record<string, number> = {
  high: 0,
  routine: 1
}

function getRiskRank(risk: string): number {
  return RISK_RANK[risk.toLowerCase()] ?? 2
}

function getPriorityRank(priority: string): number {
  const match = priority.match(/^P(\d+)$/i)
  return match ? parseInt(match[1], 10) : 99
}

function compareTaskIdNumbers(a: string, b: string): number {
  const aNumber = Number(a.match(/\d+$/)?.[0] ?? Number.NaN)
  const bNumber = Number(b.match(/\d+$/)?.[0] ?? Number.NaN)
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) {
    return aNumber - bNumber
  }
  return a.localeCompare(b)
}

function sortAttentionTasks(a: CoopBoardTask, b: CoopBoardTask): number {
  const riskDiff = getRiskRank(a.risk) - getRiskRank(b.risk)
  if (riskDiff !== 0) return riskDiff

  const priorityDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority)
  if (priorityDiff !== 0) return priorityDiff

  const aStalled = a.attention?.stalledAt ?? a.mtimeMs ?? 0
  const bStalled = b.attention?.stalledAt ?? b.mtimeMs ?? 0
  if (bStalled !== aStalled) {
    return bStalled - aStalled
  }

  return compareTaskIdNumbers(a.id, b.id)
}

function getTaskStateLabel(state: CoopTaskState): string {
  switch (state) {
    case 'draft':
      return 'Draft'
    case 'ready':
      return 'Ready'
    case 'working':
      return 'Working'
    case 'review':
      return 'Review'
    case 'done':
      return 'Done'
    case 'blocked':
      return 'Blocked'
    default:
      return 'Draft'
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function loadEvidenceContent(filePath: string): Promise<{ content: string; isImage: boolean }> {
  try {
    if (typeof (window.electron as any)?.ipcRenderer?.invoke === 'function') {
      return await (window.electron as any).ipcRenderer.invoke('coopBoard:readEvidenceFile', { filePath })
    }
  } catch {
    // fallback
  }
  if (typeof window.api?.fs?.readFile === 'function') {
    const res = await window.api.fs.readFile({ filePath })
    if (res.isImage || res.mimeType?.startsWith('image/')) {
      const mime = res.mimeType || 'image/png'
      return { content: `data:${mime};base64,${res.content}`, isImage: true }
    }
    return { content: res.content, isImage: false }
  }
  throw new Error('Unable to read file content')
}

function TaskStateBadge({ task }: { task: CoopBoardTask }) {
  const displayedState = task.blocked && task.state !== 'done' ? 'blocked' : task.state
  return <Badge variant={STATE_BADGE_VARIANT[displayedState]}>{getTaskStateLabel(displayedState)}</Badge>
}

function TaskRow({
  task,
  isSelected,
  onSelect
}: {
  task: CoopBoardTask
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={`grid grid-cols-[112px_1fr_104px_160px] gap-3 px-3 py-2 text-sm cursor-pointer transition-colors ${
        isSelected ? 'bg-accent/80 font-medium border-l-2 border-primary' : 'hover:bg-accent/50'
      }`}
    >
      <div className="font-mono text-xs text-muted-foreground flex flex-col justify-center">
        <span>{task.id}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{task.title}</p>
          {task.evidenceMissing ? (
            <Badge variant="destructive" className="font-mono text-[10px] px-1.5 py-0 shrink-0">
              evidence claimed, file not found
            </Badge>
          ) : task.evidenceFiles.length > 0 ? (
            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 shrink-0 gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/40">
              {task.evidenceFiles.length} file{task.evidenceFiles.length > 1 ? 's' : ''}
            </Badge>
          ) : null}
        </div>
        {task.attention?.needed && task.attention.reason ? (
          <p className="mt-1 truncate text-xs font-medium text-destructive">
            {task.attention.reason}
          </p>
        ) : task.blockingReasons.length > 0 ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Blocked by {task.blockingReasons.join(', ')}
          </p>
        ) : task.integration?.reviewDecision ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Review {task.integration.reviewDecision}
            {task.integration.mergeCommit ? ` · merge ${task.integration.mergeCommit}` : ''}
          </p>
        ) : null}
        {task.worktreePath ? (
          <p className="mt-1 flex items-center gap-1 truncate font-mono text-xs text-muted-foreground">
            <GitBranch className="size-3 shrink-0" />
            {task.worktreePath}
          </p>
        ) : null}
      </div>
      <div className="flex items-start">
        <TaskStateBadge task={task} />
      </div>
      <div className="flex items-start justify-end gap-1 text-xs text-muted-foreground">
        <Badge variant="outline" className="font-mono text-[11px]">
          {task.priority}
        </Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          {task.risk}
        </Badge>
      </div>
    </div>
  )
}

function ImageThumbnail({ file, onOpen }: { file: CoopTaskEvidenceFile; onOpen: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unmounted = false
    setLoading(true)
    loadEvidenceContent(file.absolutePath)
      .then((res) => {
        if (!unmounted) {
          setSrc(res.content)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!unmounted) setLoading(false)
      })
    return () => {
      unmounted = true
    }
  }, [file.absolutePath])

  return (
    <div
      onClick={onOpen}
      className="group relative flex h-24 w-36 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-muted/30 hover:border-primary transition-all"
    >
      {loading ? (
        <RefreshCw className="size-4 animate-spin text-muted-foreground" />
      ) : src ? (
        <>
          <img src={src} alt={file.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye className="size-5 text-white" />
          </div>
        </>
      ) : (
        <ImageIcon className="size-6 text-muted-foreground" />
      )}
    </div>
  )
}

function FilePreviewModal({ file, onClose }: { file: CoopTaskEvidenceFile; onClose: () => void }) {
  const [data, setData] = useState<{ content: string; isImage: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    loadEvidenceContent(file.absolutePath)
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to read file')
        setLoading(false)
      })
  }, [file.absolutePath])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            {file.fileType === 'image' ? (
              <ImageIcon className="size-4 text-blue-500" />
            ) : file.fileType === 'json' ? (
              <FileCode className="size-4 text-amber-500" />
            ) : (
              <FileText className="size-4 text-emerald-500" />
            )}
            <span className="font-mono text-sm font-semibold">{file.name}</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {formatFileSize(file.size)}
            </Badge>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="size-5 animate-spin mr-2" /> Loading preview…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-destructive py-8 justify-center">
              <AlertCircle className="size-5" />
              <span>{error}</span>
            </div>
          ) : data?.isImage || file.fileType === 'image' ? (
            <div className="flex items-center justify-center py-2">
              <img src={data?.content} alt={file.name} className="max-h-[70vh] max-w-full rounded-md object-contain shadow-md" />
            </div>
          ) : (
            <pre className="max-h-[65vh] overflow-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {data?.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskDetailSection({
  task,
  onOpenPreview
}: {
  task: CoopBoardTask
  onOpenPreview: (file: CoopTaskEvidenceFile) => void
}) {
  return (
    <div className="mt-4 rounded-md border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-primary">{task.id}</span>
            <TaskStateBadge task={task} />
            <Badge variant="outline" className="font-mono text-xs">
              Priority: {task.priority}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              Risk: {task.risk}
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-semibold">{task.title}</h3>
        </div>
      </div>

      {task.evidenceMissing ? (
        <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold">evidence claimed, file not found</p>
            <p className="mt-0.5 opacity-90">
              Task spec claims hands-on evidence, but no matching file (pattern <code className="font-mono">{task.id}-*</code>) exists under <code className="font-mono">docs/planning/evidence/</code>.
            </p>
          </div>
        </div>
      ) : null}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          Hands-on Evidence Files ({task.evidenceFiles.length})
        </h4>
        {task.evidenceFiles.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 italic">
            No evidence files found under <code className="font-mono">docs/planning/evidence/</code> matching <code className="font-mono">{task.id}-*</code>.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {task.evidenceFiles.map((file) => (
              <div key={file.name} className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 hover:border-accent transition-colors">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    {file.fileType === 'image' ? (
                      <ImageIcon className="size-3.5 shrink-0 text-blue-500" />
                    ) : file.fileType === 'json' ? (
                      <FileCode className="size-3.5 shrink-0 text-amber-500" />
                    ) : (
                      <FileText className="size-3.5 shrink-0 text-emerald-500" />
                    )}
                    <span className="truncate font-mono text-xs font-medium" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                    {formatFileSize(file.size)}
                  </Badge>
                </div>

                {file.fileType === 'image' ? (
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <ImageThumbnail file={file} onOpen={() => onOpenPreview(file)} />
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => onOpenPreview(file)}>
                      <Eye className="size-3" /> View Image
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="font-mono text-[11px] text-muted-foreground uppercase">{file.fileType}</span>
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => onOpenPreview(file)}>
                      <Eye className="size-3" /> Preview
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BoardSummary({ tasks }: { tasks: CoopBoardTask[] }) {
  const counts = useMemo(() => {
    const next: Record<CoopTaskState, number> = {
      draft: 0,
      ready: 0,
      working: 0,
      review: 0,
      done: 0,
      blocked: 0
    }
    for (const task of tasks) {
      if (task.blocked && task.state !== 'done') {
        next.blocked += 1
      } else {
        next[task.state] += 1
      }
    }
    return next
  }, [tasks])

  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(counts) as CoopTaskState[]).map((state) => (
        <Badge key={state} variant={STATE_BADGE_VARIANT[state]} className="gap-1">
          {getTaskStateLabel(state)}
          <span className="font-mono text-[11px]">{counts[state]}</span>
        </Badge>
      ))}
    </div>
  )
}

export default function CoopBoardScreen() {
  const activeRepoId = useAppStore((state) => state.activeRepoId)
  const repos = useAppStore((state) => state.repos)
  const repo = useMemo(() => {
    const activeRepo = repos.find((item) => item.id === activeRepoId)
    return activeRepo && isGitRepoKind(activeRepo) ? activeRepo : repos.find((item) => isGitRepoKind(item))
  }, [activeRepoId, repos])
  const repoRoot = repo?.path ?? ''
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<CoopBoardResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<CoopTaskEvidenceFile | null>(null)
  const [filter, setFilter] = useState<'all' | 'attention'>('all')

  const fetchBoard = useCallback(async () => {
    if (!repoRoot) {
      setResult(null)
      return
    }
    setLoading(true)
    try {
      const res = await window.api.coopBoard?.listTasks({ repoRoot })
      setResult(res ?? null)
      if (res?.tasks && res.tasks.length > 0 && !selectedTaskId) {
        setSelectedTaskId(res.tasks[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [repoRoot, selectedTaskId])

  useEffect(() => {
    const onOpen = (): void => {
      setOpen(true)
      void fetchBoard()
    }
    window.addEventListener(COOP_BOARD_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(COOP_BOARD_OPEN_EVENT, onOpen)
  }, [fetchBoard])

  const close = useCallback((): void => {
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  const selectedTask = useMemo(() => {
    if (!result?.tasks) return null
    return result.tasks.find((t) => t.id === selectedTaskId) ?? result.tasks[0] ?? null
  }, [result?.tasks, selectedTaskId])

  const attentionTasks = useMemo(() => {
    if (!result?.tasks) return []
    return result.tasks.filter((task) => task.attention?.needed).sort(sortAttentionTasks)
  }, [result?.tasks])

  const displayedTasks = useMemo(() => {
    if (!result?.tasks) return []
    return filter === 'attention' ? attentionTasks : result.tasks
  }, [filter, result?.tasks, attentionTasks])

  if (!open) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex justify-end">
      <div className="pointer-events-auto flex h-full w-full max-w-2xl flex-col border-l bg-background p-4 shadow-xl">
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <GitPullRequestArrow className="size-4 text-muted-foreground" />
                Coop Task Board
              </CardTitle>
              <p className="font-mono text-xs text-muted-foreground">{repoRoot || 'No git repository selected'}</p>
              {result?.tasks ? <BoardSummary tasks={result.tasks} /> : null}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={fetchBoard} disabled={loading || !repoRoot} aria-label="Refresh Coop Task Board">
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close Coop Task Board">
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto">
            {!repoRoot ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Select a git repository to read Coop task specs.
              </p>
            ) : loading && !result ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <RefreshCw className="size-4 animate-spin" />
                Reading task specs…
              </div>
            ) : result?.error ? (
              <div className="flex items-start gap-3 rounded-md border p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium">Cannot read Coop tasks</p>
                  <p className="mt-1 text-xs text-muted-foreground">{result.error}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={fetchBoard}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : result?.tasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No Coop task specs found.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                  >
                    All Tasks ({result?.tasks.length ?? 0})
                  </Button>
                  <Button
                    variant={filter === 'attention' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('attention')}
                    className="gap-1.5"
                  >
                    Needs Attention
                    <Badge variant={attentionTasks.length > 0 ? 'destructive' : 'secondary'} className="px-1.5 py-0 text-[10px]">
                      {attentionTasks.length}
                    </Badge>
                  </Button>
                </div>

                {displayedTasks.length === 0 && filter === 'attention' ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No tasks currently require human attention.</p>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-md border">
                      <div className="grid grid-cols-[112px_1fr_104px_160px] gap-3 border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>Task</span>
                        <span>Lifecycle</span>
                        <span>State</span>
                        <span className="text-right">Meta</span>
                      </div>
                      <div className="max-h-[380px] divide-y overflow-auto scrollbar-sleek">
                        {displayedTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            isSelected={task.id === selectedTask?.id}
                            onSelect={() => setSelectedTaskId(task.id)}
                          />
                        ))}
                      </div>
                    </div>

                    {selectedTask ? (
                      <TaskDetailSection task={selectedTask} onOpenPreview={(file) => setPreviewFile(file)} />
                    ) : null}
                  </>
                )}
              </div>
            )}

            {previewFile ? <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
