import { Opencode } from '@opencode-ai/sdk'
import {
  toOpenCodeSession,
  type OpenCodeSdkListSessionsResult,
  type OpenCodeSession
} from '../../shared/opencode-sdk-types'
import {
  listRegisteredOpenCodeServes,
  type OpenCodeServeHandle
} from '../providers/opencode-headless-dispatch'

export async function listOpenCodeSessions(
  getServes: () => OpenCodeServeHandle[] = listRegisteredOpenCodeServes,
  createClient: (url: string) => Opencode = (url) => new Opencode({ baseURL: url, timeout: 5_000 })
): Promise<OpenCodeSdkListSessionsResult> {
  const serves = getServes()
  if (serves.length === 0) {
    return { sessions: [] }
  }

  const allSessions: OpenCodeSession[] = []
  const errors: string[] = []

  for (const serve of serves) {
    try {
      const sdk = createClient(serve.url)
      const rawSessions = await sdk.session.list()
      const mapped = rawSessions.map((s) => ({
        ...toOpenCodeSession(s),
        worktreeId: serve.worktreeId,
        worktreeDir: serve.worktreeDir
      }))
      allSessions.push(...mapped)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`${serve.worktreeId} (${serve.url}): ${message}`)
    }
  }

  if (errors.length > 0 && allSessions.length === 0) {
    return { sessions: [], error: errors.join('; ') }
  }

  return { sessions: allSessions, error: errors.length > 0 ? errors.join('; ') : undefined }
}
