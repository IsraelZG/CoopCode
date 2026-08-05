// Why: Session isn't re-exported from the package root; only from the /resources subpath (see its package.json "exports").
import type { Session } from '@opencode-ai/sdk/resources'

export type OpenCodeSession = {
  id: string
  title: string
  mode?: string
  path?: string
  createdAt?: number
  updatedAt?: number
}

export type OpenCodeSdkListSessionsResult = {
  sessions: OpenCodeSession[]
  error?: string
}

export function toOpenCodeSession(s: Session): OpenCodeSession {
  return {
    id: s.id,
    title: s.title ?? '',
    // Why: the real Session shape has no mode/path; kept optional on OpenCodeSession for callers, always undefined here.
    createdAt: s.time?.created,
    updatedAt: s.time?.updated
  }
}
