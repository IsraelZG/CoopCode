// Why: Session isn't re-exported from the package root; only from the /resources subpath (see its package.json "exports").
// Its shape also has no mode/path/created_at/updated_at (older-alpha fields);
// the mapper below reads what the installed client (0.1.0-alpha.21) actually returns.
import type { Session } from '@opencode-ai/sdk/resources'

export type OpenCodeSession = {
  id: string
  title: string
  mode?: string
  path?: string
  createdAt?: number
  updatedAt?: number
  worktreeId?: string
  worktreeDir?: string
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
