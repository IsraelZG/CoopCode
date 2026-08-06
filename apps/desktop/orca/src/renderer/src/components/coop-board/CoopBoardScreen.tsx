import { AlertCircle, GitBranch, GitPullRequestArrow, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import type { CoopBoardResult, CoopBoardTask, CoopTaskState } from '../../../main/ipc/coop-board'

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
  }
}

function TaskStateBadge({ task }: { task: CoopBoardTask }) {
  const displayedState = task.blocked && task.state !== 'done' ? 'blocked' : task.state
  return <Badge variant={STATE_BADGE_VARIANT[displayedState]}>{getTaskStateLabel(displayedState)}</Badge>
}

function TaskRow({ task }: { task: CoopBoardTask }) {
  return (
    <div className="grid grid-cols-[112px_1fr_104px_160px] gap-3 px-3 py-2 text-sm hover:bg-accent">
      <div className="font-mono text-xs text-muted-foreground">{task.id}</div>
      <div className="min-w-0">
        <p className="truncate font-medium">{task.title}</p>
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
  const [result, setResult] = useState<CoopBoardResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'attention'>('all')

  const fetchBoard = useCallback(async () => {
    if (!repoRoot) {
      setResult(null)
      return
    }
    setLoading(true)
    try {
      setResult(await window.api.coopBoard?.listTasks({ repoRoot }))
    } finally {
      setLoading(false)
    }
  }, [repoRoot])

  useEffect(() => {
    void fetchBoard()
  }, [fetchBoard])

  const attentionTasks = useMemo(() => {
    if (!result?.tasks) return []
    return result.tasks.filter((task) => task.attention?.needed).sort(sortAttentionTasks)
  }, [result?.tasks])

  const displayedTasks = useMemo(() => {
    if (!result?.tasks) return []
    return filter === 'attention' ? attentionTasks : result.tasks
  }, [filter, result?.tasks, attentionTasks])

  return (
    <Card className="mx-auto mt-8 max-w-5xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GitPullRequestArrow className="size-4 text-muted-foreground" />
            Coop Task Board
          </CardTitle>
          <p className="font-mono text-xs text-muted-foreground">{repoRoot || 'No git repository selected'}</p>
          {result?.tasks ? <BoardSummary tasks={result.tasks} /> : null}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={fetchBoard} disabled={loading || !repoRoot}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
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
          <div className="space-y-3">
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
              <div className="overflow-hidden rounded-md border">
                <div className="grid grid-cols-[112px_1fr_104px_160px] gap-3 border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Task</span>
                  <span>Lifecycle</span>
                  <span>State</span>
                  <span className="text-right">Meta</span>
                </div>
                <div className="max-h-[520px] divide-y overflow-auto scrollbar-sleek">
                  {displayedTasks.map((task) => <TaskRow key={task.id} task={task} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
