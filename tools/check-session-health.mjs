import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HUNG_THRESHOLD_MS = 10 * 60 * 1000

export function checkSessionHealth(dbPath, sessionId, now = Date.now()) {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const messages = db.prepare(
      `SELECT id, role, parts, created_at, finished_at
       FROM messages
       WHERE session_id = ?
       ORDER BY created_at ASC`
    ).all(sessionId)

    if (messages.length === 0) {
      return { sessionId, verdict: 'healthy', details: { messageCount: 0 } }
    }

    const loopingResult = detectLooping(messages)
    if (loopingResult) {
      return { sessionId, verdict: 'looping', details: loopingResult }
    }

    const last = messages[messages.length - 1]
    const lastTs = parseTimestamp(last.created_at)
    const elapsedMs = now - lastTs
    const elapsedSeconds = Math.round(elapsedMs / 1000)

    if (elapsedMs > HUNG_THRESHOLD_MS) {
      if (last.role === 'assistant' && (last.finished_at === null || last.finished_at === undefined || last.finished_at === '')) {
        return {
          sessionId,
          verdict: 'in_flight_overdue',
          details: { elapsedSeconds, lastMessageId: last.id, role: last.role }
        }
      }
      return {
        sessionId,
        verdict: 'stalled',
        details: { elapsedSeconds, lastMessageId: last.id }
      }
    }

    return { sessionId, verdict: 'healthy', details: { messageCount: messages.length } }
  } finally {
    db.close()
  }
}

function detectLooping(messages) {
  const assistantToolCalls = []
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue
    const toolCall = extractToolCall(msg.parts)
    if (toolCall) {
      assistantToolCalls.push({ name: toolCall.name, input: toolCall.input, messageId: msg.id })
    }
  }

  if (assistantToolCalls.length < 3) return null

  let runLength = 1
  for (let i = 1; i < assistantToolCalls.length; i++) {
    const curr = assistantToolCalls[i]
    const prev = assistantToolCalls[i - 1]
    if (curr.name === prev.name && curr.input === prev.input) {
      runLength++
      if (runLength >= 3) {
        return {
          toolName: curr.name,
          input: truncate(curr.input, 200),
          runLength
        }
      }
    } else {
      runLength = 1
    }
  }
  return null
}

function extractToolCall(partsJson) {
  if (!partsJson) return null
  let parts
  try {
    parts = typeof partsJson === 'string' ? JSON.parse(partsJson) : partsJson
  } catch {
    return null
  }
  if (!Array.isArray(parts)) return null
  for (const part of parts) {
    if (part.type === 'tool_call' && part.data && part.data.name) {
      return {
        name: part.data.name,
        input: typeof part.data.input === 'string' ? part.data.input : JSON.stringify(part.data.input ?? '')
      }
    }
  }
  return null
}

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str ?? ''
  return str.slice(0, maxLen) + '...'
}

function parseTimestamp(value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  const n = Number(value)
  if (!Number.isNaN(n)) return n
  const d = new Date(value)
  return d.getTime() || 0
}

const isMainModule = process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])

if (isMainModule) {
  const dbPath = process.argv[2]
  const sessionId = process.argv[3]
  if (!dbPath || !sessionId) {
    console.error('Usage: node tools/check-session-health.mjs <db-path> <session-id>')
    process.exit(2)
  }
  try {
    const result = checkSessionHealth(dbPath, sessionId)
    console.log(JSON.stringify(result, null, 2))
  } catch (err) {
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }
}
