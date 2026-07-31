import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkSessionHealth } from './check-session-health.mjs'

function toolCallParts(name, input) {
  return JSON.stringify([{ type: 'tool_call', data: { name, input } }])
}

function textParts(text) {
  return JSON.stringify([{ type: 'text', data: text }])
}

function createFileFixtureDb(dbPath, messages) {
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      parts TEXT,
      model TEXT,
      created_at TEXT,
      updated_at TEXT,
      finished_at TEXT,
      provider TEXT,
      is_summary_message INTEGER DEFAULT 0
    )
  `)
  const insert = db.prepare(
    `INSERT INTO messages (id, session_id, role, parts, model, created_at, updated_at, finished_at, provider, is_summary_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  for (const msg of messages) {
    insert.run(
      msg.id,
      msg.session_id ?? 'session-1',
      msg.role,
      msg.parts ?? null,
      msg.model ?? 'test-model',
      msg.created_at,
      msg.updated_at ?? msg.created_at,
      msg.finished_at ?? null,
      msg.provider ?? 'test-provider',
      msg.is_summary_message ?? 0
    )
  }
  db.close()
  return dbPath
}

const NOW = Date.now()
const RECENT = new Date(NOW - 10_000).toISOString()
const OLD = new Date(NOW - 700_000).toISOString()

describe('checkSessionHealth', () => {
  it('reports healthy for a recent session with normal messages', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devx009-'))
    const dbPath = path.join(dir, 'healthy.db')

    createFileFixtureDb(dbPath, [
      { id: 'm1', role: 'user', parts: textParts('hello'), created_at: RECENT, finished_at: new Date(NOW - 9000).toISOString() },
      { id: 'm2', role: 'assistant', parts: textParts('hi there'), created_at: RECENT, finished_at: new Date(NOW - 8000).toISOString() },
      { id: 'm3', role: 'user', parts: textParts('how are you'), created_at: RECENT, finished_at: new Date(NOW - 7000).toISOString() },
    ])

    const result = checkSessionHealth(dbPath, 'session-1', NOW)
    assert.equal(result.verdict, 'healthy')
    assert.equal(result.sessionId, 'session-1')
    fs.rmSync(dir, { recursive: true })
  })

  it('reports stalled when last message is older than 600s (role: tool)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devx009-'))
    const dbPath = path.join(dir, 'stalled.db')

    createFileFixtureDb(dbPath, [
      { id: 'm1', role: 'user', parts: textParts('do something'), created_at: OLD, finished_at: new Date(NOW - 699000).toISOString() },
      { id: 'm2', role: 'assistant', parts: toolCallParts('bash', 'ls'), created_at: OLD, finished_at: new Date(NOW - 698000).toISOString() },
      { id: 'm3', role: 'tool', parts: textParts('file1\nfile2'), created_at: OLD, finished_at: null },
    ])

    const result = checkSessionHealth(dbPath, 'session-1', NOW)
    assert.equal(result.verdict, 'stalled')
    assert.equal(result.details.lastMessageId, 'm3')
    assert.ok(result.details.elapsedSeconds >= 699)
    fs.rmSync(dir, { recursive: true })
  })

  it('reports in_flight_overdue when last message is assistant with finished_at NULL and > 600s old', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devx009-'))
    const dbPath = path.join(dir, 'overdue.db')

    createFileFixtureDb(dbPath, [
      { id: 'm1', role: 'user', parts: textParts('do something'), created_at: OLD, finished_at: new Date(NOW - 699000).toISOString() },
      { id: 'm2', role: 'assistant', parts: toolCallParts('bash', 'ls'), created_at: OLD, finished_at: null },
    ])

    const result = checkSessionHealth(dbPath, 'session-1', NOW)
    assert.equal(result.verdict, 'in_flight_overdue')
    assert.equal(result.details.lastMessageId, 'm2')
    assert.equal(result.details.role, 'assistant')
    assert.ok(result.details.elapsedSeconds >= 699)
    fs.rmSync(dir, { recursive: true })
  })

  it('reports looping when 3+ consecutive assistant messages have identical tool name AND input', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devx009-'))
    const dbPath = path.join(dir, 'looping.db')

    const sameInput = JSON.stringify({ command: 'ls -la' })
    createFileFixtureDb(dbPath, [
      { id: 'm1', role: 'user', parts: textParts('list files'), created_at: RECENT },
      { id: 'm2', role: 'assistant', parts: toolCallParts('bash', sameInput), created_at: RECENT, finished_at: RECENT },
      { id: 'm3', role: 'tool', parts: textParts('result1'), created_at: RECENT, finished_at: RECENT },
      { id: 'm4', role: 'assistant', parts: toolCallParts('bash', sameInput), created_at: RECENT, finished_at: RECENT },
      { id: 'm5', role: 'tool', parts: textParts('result2'), created_at: RECENT, finished_at: RECENT },
      { id: 'm6', role: 'assistant', parts: toolCallParts('bash', sameInput), created_at: RECENT, finished_at: RECENT },
    ])

    const result = checkSessionHealth(dbPath, 'session-1', NOW)
    assert.equal(result.verdict, 'looping')
    assert.equal(result.details.toolName, 'bash')
    assert.equal(result.details.runLength, 3)
    assert.ok(result.details.input.includes('ls -la'))
    fs.rmSync(dir, { recursive: true })
  })

  it('does NOT report looping when 5+ same-name tool calls have different inputs', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devx009-'))
    const dbPath = path.join(dir, 'false-positive.db')

    const messages = [
      { id: 'm0', role: 'user', parts: textParts('read all files'), created_at: RECENT },
    ]
    for (let i = 0; i < 6; i++) {
      messages.push({
        id: `ma${i}`,
        role: 'assistant',
        parts: toolCallParts('view', JSON.stringify({ file_path: `/src/file${i}.ts` })),
        created_at: RECENT,
        finished_at: RECENT
      })
      messages.push({
        id: `mt${i}`,
        role: 'tool',
        parts: textParts(`content of file ${i}`),
        created_at: RECENT,
        finished_at: RECENT
      })
    }

    createFileFixtureDb(dbPath, messages)

    const result = checkSessionHealth(dbPath, 'session-1', NOW)
    assert.equal(result.verdict, 'healthy')
    fs.rmSync(dir, { recursive: true })
  })

  it('reports healthy for an empty session', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devx009-'))
    const dbPath = path.join(dir, 'empty.db')

    createFileFixtureDb(dbPath, [])

    const result = checkSessionHealth(dbPath, 'session-1', NOW)
    assert.equal(result.verdict, 'healthy')
    assert.equal(result.details.messageCount, 0)
    fs.rmSync(dir, { recursive: true })
  })
})
