// Why: the installed @opencode-ai/sdk (0.1.0-alpha.21) does not re-export
// Session from the package root; it lives on the resources entry. Its shape
// also differs from older alphas (time.created/time.updated instead of
// created_at/updated_at; no mode/path), so the mapper reads the fields the
// installed client actually returns.
import type { Session } from '@opencode-ai/sdk/resources/session'

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
    createdAt: s.time?.created ? new Date(s.time.created).getTime() : undefined,
    updatedAt: s.time?.updated ? new Date(s.time.updated).getTime() : undefined
  }
}
