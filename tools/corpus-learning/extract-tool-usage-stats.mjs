import { DatabaseSync } from 'node:sqlite'
import { statSync, writeFileSync } from 'node:fs'
import process from 'node:process'

// Read-only tool-usage statistics over the Crush session corpus.
//
// DEVX-025: reads tool_results from `role='tool'` message rows and bash
// commands from `role='assistant'` tool_call parts. The corpus of record is
// the .bak; the live crush.db is analyzed separately and never merged.
//
// Safety contract (same as DEVX-023): both databases are opened with
// `{ readOnly: true }` and the .bak's size and mtime are verified unchanged
// after a full run (meta.bakFileUnchanged).

const BAK_DB_PATH = process.env.BAK_DB_PATH || 'C:/Dev2026/Docs/.crush/crush.db.bak'
const LIVE_DB_PATH = process.env.LIVE_DB_PATH || 'C:/Dev2026/Docs/.crush/crush.db'
const OUTPUT = process.env.OUTPUT || null

const ERROR_SAMPLE_PER_BUCKET = 5
const BASH_SAMPLE_PER_BUCKET = 5
const GIT_BRANCH_SAMPLE = 3

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function toContentString(content) {
  if (content === null || content === undefined) return ''
  if (typeof content === 'string') return content
  // Defensive: some harnesses may store arrays/objects (e.g. image parts).
  try {
    return JSON.stringify(content)
  } catch {
    return String(content)
  }
}

function classifyEditError(content) {
  const c = content.slice(0, 300)
  if (/modified since/.test(c) && /last read/.test(c)) return 'stale-read-guard'
  if (/old_string not found/.test(c)) return 'old-string-not-found'
  if (/must read (the )?file before editing/i.test(c) || /use View tool before editing/i.test(c)) return 'edit-without-read'
  if (/new content (is the )?same as old content/.test(c)) return 'no-op-edit'
  if (/appears multiple times/.test(c)) return 'ambiguous-match'
  if (/user cancelled/i.test(c)) return 'user-cancelled'
  if (/there was (an )?error while executing the tool/i.test(c)) return 'exec-error'
  if (/tool not found/.test(c)) return 'tool-not-found'
  if (/invalid JSON input/.test(c)) return 'malformed-json'
  if (/file already exists/.test(c)) return 'file-exists'
  if (/missing required parameter/.test(c)) return 'missing-param'
  return 'unclassified'
}

const GIT_VERBS =
  /(status|log|diff|branch|checkout|show|rev-parse|remote|add|commit|push|pull|merge|fetch|stash|blame|tag|rebase|clean|reflog|worktree|reset|ls-files|init|clone|switch|restore|describe|shortlog|count-objects|gc|fsck|submodule|cherry-pick)\b/

function classifyBashCommand(command) {
  const c = command.replace(/^rtk\s+/, '').trim()
  if (!c) return 'empty'
  if (new RegExp(`\\bgit(\\s+-C\\s+(\"[^\"]*\"|'[^']*'|\\S+))?(\\s+--[a-z][a-z-]*=[^\\s]+)?\\s+${GIT_VERBS.source}`).test(c)) return 'git-vcs'
  if (/\b(node|pnpm|npm|npx|bun|yarn|tsc|vitest|jest|mocha|eslint|tsx|deno|npm-run)\b/.test(c)) return 'build-tooling'
  if (/\b(cat|ls|head|tail|find|grep|rg|wc|stat|more|less|type|dir|sed|awk|cut|sort|uniq|tr|tree)\b/.test(c)) return 'file-read'
  if (/^\s*(cd|pushd|popd)\b/.test(c)) return 'cd-navigation'
  if (/\b(Get-|Set-|Select-|Write-Host|Copy-Item|Move-Item|Remove-Item|New-Item|Test-Path|Invoke-|Get-Content|Get-ChildItem|Start-Process|Stop-Process)\b/.test(c)) return 'powershell'
  if (/^\s*(echo|printf|rem)\b/.test(c)) return 'echo-trivial'
  if (/\b(gh|az|aws|docker|kubectl|psql|mysql)\b/.test(c)) return 'external-cli'
  return 'other'
}

const MALFORMED_NAME = /^(Edit|globl|gl)$|^apid_[0-9a-fA-F-]{8,}$/

function analyzeDb(dbPath, { deepDives }) {
  let db = null
  let before = null
  let after = null
  let unchanged = null
  try {
    before = statSync(dbPath)
    db = new DatabaseSync(dbPath, { open: true, readOnly: true })
  } catch {
    return { unavailable: true, path: dbPath }
  }

  const sessions = db.prepare('SELECT COUNT(*) AS c FROM sessions').get().c
  const toolMessages = db.prepare("SELECT COUNT(*) AS c FROM messages WHERE role='tool'").get().c

  // Pass 1: tool_results from role='tool' rows.
  const perTool = new Map() // name -> { calls, errors, totalChars, lengths[], examples }
  const malformed = {}
  const toolRows = db.prepare("SELECT id, session_id, parts FROM messages WHERE role='tool'").all()

  for (const row of toolRows) {
    let parts = []
    try {
      parts = JSON.parse(row.parts)
    } catch {
      continue
    }
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      if (!part || typeof part !== 'object' || part.type !== 'tool_result') continue
      const data = part.data || {}
      const name = String(data.name ?? '')
      const content = toContentString(data.content)
      const isError = Boolean(data.is_error ?? data.isError ?? false)
      if (!name) continue

      if (MALFORMED_NAME.test(name)) {
        malformed[name] = (malformed[name] || 0) + 1
      }

      let entry = perTool.get(name)
      if (!entry) {
        entry = { name, calls: 0, errors: 0, totalChars: 0, lengths: [], examples: [] }
        perTool.set(name, entry)
      }
      entry.calls++
      if (isError) entry.errors++
      entry.totalChars += content.length
      entry.lengths.push(content.length)
      if (deepDives && entry.examples.length < ERROR_SAMPLE_PER_BUCKET && isError) {
        entry.examples.push({ sessionId: row.session_id, messageId: row.id, snippet: content.slice(0, 160) })
      }
    }
  }

  const tools = [...perTool.values()].map((entry) => {
    const avgChars = entry.calls > 0 ? Math.round(entry.totalChars / entry.calls) : 0
    return {
      name: entry.name,
      calls: entry.calls,
      errors: entry.errors,
      errorRate: entry.calls > 0 ? Math.round((entry.errors / entry.calls) * 1000) / 1000 : 0,
      totalChars: entry.totalChars,
      avgChars,
      medianChars: median(entry.lengths),
      maxChars: entry.lengths.length > 0 ? Math.max(...entry.lengths) : 0,
      ...(deepDives && entry.examples.length > 0 ? { errorExamples: entry.examples } : {})
    }
  })
  tools.sort((a, b) => b.calls - a.calls)

  const totalCalls = tools.reduce((sum, t) => sum + t.calls, 0)
  const totalChars = tools.reduce((sum, t) => sum + t.totalChars, 0)

  // Families: native / lsp_* / mcp_* (per server).
  const families = {
    native: { calls: 0, totalChars: 0, errors: 0, toolCount: 0 },
    lsp: { calls: 0, totalChars: 0, errors: 0, toolCount: 0 },
    mcp: { calls: 0, totalChars: 0, errors: 0, toolCount: 0 }
  }
  const mcpByServer = {}
  for (const t of tools) {
    let family = 'native'
    let server = null
    if (t.name.startsWith('mcp_')) {
      family = 'mcp'
      const rest = t.name.replace(/^mcp_+/, '')
      server = rest.split('_')[0] || 'unknown'
      if (!mcpByServer[server]) mcpByServer[server] = { calls: 0, totalChars: 0, errors: 0, toolCount: 0 }
      mcpByServer[server].calls += t.calls
      mcpByServer[server].totalChars += t.totalChars
      mcpByServer[server].errors += t.errors
      mcpByServer[server].toolCount++
    } else if (t.name.startsWith('lsp_')) {
      family = 'lsp'
    }
    families[family].calls += t.calls
    families[family].totalChars += t.totalChars
    families[family].errors += t.errors
    families[family].toolCount++
  }
  const mcpServers = Object.entries(mcpByServer)
    .map(([server, s]) => ({ server, ...s, shareOfContext: totalChars > 0 ? Math.round((s.totalChars / totalChars) * 1000) / 10 : 0 }))
    .sort((a, b) => b.totalChars - a.totalChars)

  let editErrors = null
  let gitBranch = null
  let bashCommands = null

  if (deepDives) {
    // Edit error buckets over every failed edit tool_result.
    const buckets = {}
    const bucketExamples = {}
    for (const row of toolRows) {
      let parts = []
      try {
        parts = JSON.parse(row.parts)
      } catch {
        continue
      }
      if (!Array.isArray(parts)) continue
      for (const part of parts) {
        if (!part || typeof part !== 'object' || part.type !== 'tool_result') continue
        const data = part.data || {}
        if (String(data.name ?? '') !== 'edit' || !Boolean(data.is_error ?? data.isError ?? false)) continue
        const content = toContentString(data.content)
        const bucket = classifyEditError(content)
        buckets[bucket] = (buckets[bucket] || 0) + 1
        if (!bucketExamples[bucket]) bucketExamples[bucket] = []
        if (bucketExamples[bucket].length < ERROR_SAMPLE_PER_BUCKET) {
          bucketExamples[bucket].push({ sessionId: row.session_id, messageId: row.id, snippet: content.slice(0, 200) })
        }
      }
    }
    editErrors = {
      total: Object.values(buckets).reduce((s, n) => s + n, 0),
      buckets,
      examples: bucketExamples
    }

    // mcp_git_git_branch payload size profile.
    const lengths = []
    const largeExamples = []
    for (const row of toolRows) {
      let parts = []
      try {
        parts = JSON.parse(row.parts)
      } catch {
        continue
      }
      if (!Array.isArray(parts)) continue
      for (const part of parts) {
        if (!part || typeof part !== 'object' || part.type !== 'tool_result') continue
        const data = part.data || {}
        if (String(data.name ?? '') !== 'mcp_git_git_branch') continue
        const content = toContentString(data.content)
        lengths.push(content.length)
        if (content.length > 1000 && largeExamples.length < GIT_BRANCH_SAMPLE) {
          largeExamples.push({ sessionId: row.session_id, messageId: row.id, chars: content.length, snippet: content.slice(0, 400) })
        }
      }
    }
    gitBranch = {
      calls: lengths.length,
      minChars: lengths.length > 0 ? Math.min(...lengths) : 0,
      medianChars: median(lengths),
      avgChars: lengths.length > 0 ? Math.round(lengths.reduce((s, n) => s + n, 0) / lengths.length) : 0,
      maxChars: lengths.length > 0 ? Math.max(...lengths) : 0,
      callsOver1000Chars: lengths.filter((n) => n > 1000).length,
      examples: largeExamples
    }

    // Bash commands from assistant tool_call parts.
    const commandBuckets = {}
    const commandExamples = {}
    let parsedCommands = 0
    const assistantRows = db.prepare("SELECT id, session_id, parts FROM messages WHERE role='assistant' AND parts LIKE '%tool_call%'").all()
    for (const row of assistantRows) {
      let parts = []
      try {
        parts = JSON.parse(row.parts)
      } catch {
        continue
      }
      if (!Array.isArray(parts)) continue
      for (const part of parts) {
        if (!part || typeof part !== 'object' || part.type !== 'tool_call') continue
        const data = part.data || {}
        if (String(data.name ?? '') !== 'bash') continue
        let input = {}
        try {
          input = JSON.parse(data.input || '{}')
        } catch {
          continue
        }
        const command = String(input.command ?? '')
        if (!command) continue
        parsedCommands++
        const bucket = classifyBashCommand(command)
        commandBuckets[bucket] = (commandBuckets[bucket] || 0) + 1
        if (!commandExamples[bucket]) commandExamples[bucket] = []
        if (commandExamples[bucket].length < BASH_SAMPLE_PER_BUCKET) {
          commandExamples[bucket].push({ sessionId: row.session_id, messageId: row.id, command: command.slice(0, 140) })
        }
      }
    }
    bashCommands = {
      total: parsedCommands,
      buckets: commandBuckets,
      examples: commandExamples
    }
  }

  db.close()

  try {
    after = statSync(dbPath)
    unchanged = before.size === after.size && before.mtimeMs === after.mtimeMs
  } catch {
    unchanged = null
  }

  return {
    path: dbPath,
    sessions,
    toolMessages,
    totalCalls,
    totalChars,
    tools,
    families,
    mcpByServer: mcpServers,
    ...(editErrors ? { editErrors } : {}),
    ...(gitBranch ? { gitBranch } : {}),
    ...(bashCommands ? { bashCommands } : {}),
    dataQuality: { malformedNames: malformed, distinctToolNames: tools.length },
    corpusFileUnchanged: unchanged
  }
}

const bakBefore = (() => {
  try {
    const s = statSync(BAK_DB_PATH)
    return { size: s.size, mtime: new Date(s.mtimeMs).toISOString() }
  } catch {
    return null
  }
})()

const bak = analyzeDb(BAK_DB_PATH, { deepDives: true })
const live = analyzeDb(LIVE_DB_PATH, { deepDives: false })

const bakAfter = (() => {
  try {
    const s = statSync(BAK_DB_PATH)
    return { size: s.size, mtime: new Date(s.mtimeMs).toISOString() }
  } catch {
    return null
  }
})()

const result = {
  meta: {
    script: 'extract-tool-usage-stats.mjs',
    runAt: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    bakFileBefore: bakBefore,
    bakFileAfter: bakAfter,
    bakFileUnchanged: bakBefore !== null && bakAfter !== null && bakBefore.size === bakAfter.size && bakBefore.mtime === bakAfter.mtime
  },
  bak,
  live
}

const out = JSON.stringify(result, null, 2)
if (OUTPUT) {
  writeFileSync(OUTPUT, out)
}
console.log(out)
