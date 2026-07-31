import { AlertCircle, Bot, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { OpenCodeSession, OpenCodeSdkListSessionsResult } from '../../../shared/opencode-sdk-types'

function OpenCodeSessionRow({ session }: { session: OpenCodeSession }) {
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent">
      <Bot className="size-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">{session.title || session.id}</p>
        {session.mode && (
          <p className="text-xs text-muted-foreground">{session.mode}</p>
        )}
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
    void fetchSessions()
  }, [fetchSessions])

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">OpenCode Sessions</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={fetchSessions} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
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
            No sessions found. Start <code className="text-xs bg-muted px-1 rounded">opencode serve</code> to begin.
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
  )
}
