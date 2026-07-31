import { Opencode } from '@opencode-ai/sdk'
import {
  toOpenCodeSession,
  type OpenCodeSdkListSessionsResult
} from '../../shared/opencode-sdk-types'

let client: Opencode | null = null

function getBaseUrl(): string {
  return process.env.OPENCODE_BASE_URL ?? 'http://127.0.0.1:54321'
}

function getClient(): Opencode {
  if (!client) {
    client = new Opencode({
      baseURL: getBaseUrl(),
      timeout: 10_000
    })
  }
  return client
}

export async function listOpenCodeSessions(): Promise<OpenCodeSdkListSessionsResult> {
  try {
    const sessions = await getClient().session.list()
    return { sessions: sessions.map(toOpenCodeSession) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { sessions: [], error: message }
  }
}
