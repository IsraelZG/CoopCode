import { AlertCircle, Bot, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { OpenCodeSession, OpenCodeSdkListSessionsResult } from '../../../../shared/opencode-sdk-types'

export const OPENCODE_SESSIONS_OPEN_EVENT = 'opencode-sessions:open'

function OpenCodeSessionRow({ session }: { session: OpenCodeSession }) {
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent">
      <Bot className="size-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{session.title || session.id}</p>
          {session.worktreeId && (
            <Badge variant="secondary" className="text-xs shrink-0 font-mono">
              {session.worktreeId}
            </Badge>
          )}
        </div>
        {session.worktreeDir ? (
          <p className="text-xs text-muted-foreground truncate">{session.worktreeDir}</p>
        ) : session.mode ? (
          <p className="text-xs text-muted-foreground">{session.mode}</p>
        ) : null}
      </div>
      {session.mode && (
        <Badge variant="outline" className="text-xs shrink-0">
          {session.mode}
        </Badge>
      )}
    </div>
  )
}

export default function OpenCodeSessionsScreen() {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<OpenCodeSdkListSessionsResult | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const data = (await window.api.openCodeSdk.listSessions()) as OpenCodeSdkListSessionsResult
      setResult(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const onOpen = (): void => {
      setOpen(true)
      void fetchSessions()
    }
    window.addEventListener(OPENCODE_SESSIONS_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPENCODE_SESSIONS_OPEN_EVENT, onOpen)
  }, [fetchSessions])

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

  if (!open) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex justify-end">
      <div className="pointer-events-auto flex h-full w-full max-w-2xl flex-col border-l bg-background p-4 shadow-xl">
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">OpenCode Sessions</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={fetchSessions} disabled={loading} aria-label="Refresh OpenCode sessions">
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close OpenCode sessions">
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto">
            {loading && !result ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <RefreshCw className="size-4 animate-spin" />
                Connecting to OpenCode…
              </div>
            ) : result?.error ? (
              <div className="flex items-start gap-3 rounded-md border p-4">
                <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Cannot reach OpenCode</p>
                  <p className="text-xs text-muted-foreground mt-1">{result.error}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={fetchSessions}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : result?.sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No active OpenCode dispatches
              </p>
            ) : (
              <div className="divide-y">
                {result?.sessions.map((s) => (
                  <OpenCodeSessionRow key={s.id} session={s} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
