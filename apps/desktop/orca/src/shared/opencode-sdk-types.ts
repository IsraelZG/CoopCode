import type { Session } from '@opencode-ai/sdk'

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
    mode: s.mode,
    path: s.path,
    createdAt: s.created_at ? new Date(s.created_at).getTime() : undefined,
    updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : undefined
  }
}
