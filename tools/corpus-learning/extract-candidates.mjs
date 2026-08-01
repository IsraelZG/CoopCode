import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import process from 'node:process'

const CORPUS_DIR = process.env.CORPUS_DIR || 'C:/Dev2026/Docs/tasks'
const DB_PATH = process.env.DB_PATH || 'C:/Dev2026/Docs/.crush/crush.db.bak'
const OUTPUT = process.env.OUTPUT || null

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m) return {}
  const fm = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)/)
    if (kv) {
      let val = kv[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''))
      }
      fm[kv[1]] = val
    }
  }
  return fm
}

function extractSections(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const sections = {}
  let currentSection = null
  let currentSubsection = null
  const contentLines = { root: [] }
  let contentKey = 'root'

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/)
    const h3 = line.match(/^###\s+(.+)/)

    if (h2) {
      currentSection = h2[1].trim()
      currentSubsection = null
      contentKey = currentSection
      contentLines[contentKey] = []
      sections[currentSection] = { heading: currentSection, subsections: {} }
    } else if (h3) {
      currentSubsection = h3[1].trim()
      contentKey = `${currentSection}|||${currentSubsection}`
      contentLines[contentKey] = []
      if (sections[currentSection]) {
        sections[currentSection].subsections[currentSubsection] = { heading: currentSubsection }
      }
    } else if (currentSection) {
      contentLines[contentKey].push(line)
    } else {
      contentLines.root.push(line)
    }
  }

  for (const key of Object.keys(contentLines)) {
    contentLines[key] = contentLines[key].join('\n').trim()
  }

  return { sections, contentLines }
}

function findObjective(contentLines) {
  const keys = Object.keys(contentLines)
  const objKey = keys.find(k => /^1\.\s*Objetivo/.test(k))
  return objKey ? contentLines[objKey] : null
}

function findSpecFeedback(contentLines) {
  const keys = Object.keys(contentLines)
  const fbKey = keys.find(k => /^6\.\s*(Feedback|Decis)/.test(k))
  if (!fbKey) return null
  const text = contentLines[fbKey]
  if (!text) return null
  const firstPara = text.split('\n\n')[0]
  return firstPara.substring(0, 500)
}

function extractFindings(sections, contentLines, fullText) {
  const findings = []

  const section8Key = Object.keys(sections).find(k => /^8\./.test(k))
  const s8 = section8Key ? sections[section8Key] : null

  const lines = fullText.replace(/\r\n/g, '\n').split('\n')
  const headingLines = []
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^(#{1,6})\s+(.+)/)
    if (h) headingLines.push({ line: i, level: h[1].length, text: h[2].trim() })
  }

  function sectionForLine(lineNum) {
    let best = 'root'
    for (const h of headingLines) {
      if (h.line <= lineNum && h.level === 2) best = h.text
    }
    return best
  }

  function subsectionForLine(lineNum, section) {
    let best = null
    for (const h of headingLines) {
      if (h.line <= lineNum && h.level === 3) best = h.text
    }
    return best
  }

  function reworkForLine(lineNum) {
    let best = null
    for (const h of headingLines) {
      if (h.line <= lineNum && h.level === 3 && /rework/i.test(h.text)) best = h.text
    }
    return best
  }

  const seen = new Set()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const lineMarkers = [...line.matchAll(/\[([BMmi])(\d+)\]/g)]
    if (lineMarkers.length === 0) continue

    const section = sectionForLine(i)
    const subsection = subsectionForLine(i, section)
    const rework = reworkForLine(i)

    for (const [matchIndex, markerMatch] of lineMarkers.entries()) {
      const marker = `${markerMatch[1]}${markerMatch[2]}`
      const dedupKey = `${marker}@${i}@${matchIndex}`
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)

      const severityLetter = markerMatch[1]
      const severityLabel =
        severityLetter === 'B' ? 'BLOCKER' :
        severityLetter === 'M' ? 'MAJOR' :
        severityLetter === 'm' ? 'MINOR' : 'INFO'

      let text = ''
      let contextType = 'reference'

      // Case 1: bold marker with optional severity — capture text after bold close,
      // falling back to the text inside the bold if nothing follows.
      const boldMatch = line.match(/\*\*\[([BMmi])(\d+)\]\s*(?:\(?(?:BLOCKER|MAJOR|MINOR|INFO)\)?\s*[—–-]*\s*)?([\s\S]*?)\*\*(.*)$/)
      if (boldMatch) {
        const afterBold = boldMatch[4] ? boldMatch[4].trim() : ''
        const insideBold = (boldMatch[3] || '').trim()
        let usable = afterBold
        if (usable.startsWith('—') || usable.startsWith('-') || usable.startsWith(':')) {
          usable = usable.replace(/^[—\-:]\s*/, '')
        }
        text = (usable || insideBold).substring(0, 500)
        contextType = 'reviewer-finding'
      }

      // Case 2: bullet with bare marker (no bold)
      const bulletMatch = line.match(/^[\s]*[-*]\s+\[([BMmi])(\d+)\]\s+(.+)$/)
      if (bulletMatch && !text) {
        text = bulletMatch[3].trim()
        contextType = 'rework-correction'
        for (let j = i + 1; j < lines.length && j < i + 4; j++) {
          const next = lines[j]
          if (next.match(/^[\s]*[-*]\s+/)) break
          if (next.trim() === '' || next.match(/^(#{1,6})\s/)) break
          text += ' ' + next.trim()
        }
        text = text.substring(0, 500)
      }

      if (!text) {
        // Case 3: inline reference — prefer the text that follows the marker on
        // the same line; only expand to the paragraph when the line is too thin
        // to carry meaning on its own.
        const afterMarker = line
          .slice(markerMatch.index + markerMatch[0].length)
          .replace(/`/g, '')
          .replace(/\*\*/g, '')
          .replace(/^\s*[—–:.\-]\s*/, '')
          .replace(/\s+/g, ' ')
          .trim()
        let cleanedLine = line
          .replace(/`/g, '')
          .replace(/\*\*/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        if (afterMarker.length >= 25) {
          text = afterMarker.substring(0, 400)
        } else if (cleanedLine.length >= 25) {
          text = cleanedLine.substring(0, 400)
        } else {
          let paraStart = i
          while (paraStart > 0) {
            const prev = lines[paraStart - 1]
            if (prev.trim() === '' || prev.match(/^(#{1,6})\s/)) break
            paraStart--
          }
          let paraEnd = i
          while (paraEnd < lines.length - 1) {
            const next = lines[paraEnd + 1]
            if (next.trim() === '' || next.match(/^(#{1,6})\s/)) break
            paraEnd++
          }
          let context = lines.slice(paraStart, paraEnd + 1).join(' ')
          context = context.replace(/`/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
          text = context.substring(0, 400)
        }
        contextType = 'inline-reference'
      }

      findings.push({
        marker,
        severity: severityLabel,
        text: text || `(reference to ${marker} in ${section})`,
        reworkRound: rework,
        section,
        subsection,
        sourceType: contextType
      })
    }
  }

  return findings
}

function buildCitation(taskFile, taskId, finding) {
  if (!finding.section || finding.section === 'root') return null
  let sectionRef = `## ${finding.section}`
  if (finding.subsection && finding.subsection !== finding.section) {
    sectionRef += ` > ### ${finding.subsection}`
  }
  return {
    file: taskFile,
    section: sectionRef,
    grep: `\\[${finding.marker}\\]`
  }
}

function buildSessionIndex(db) {
  const sessions = db.prepare(`
    SELECT id, title, message_count, prompt_tokens, completion_tokens, created_at
    FROM sessions WHERE title IS NOT NULL
  `).all()

  const index = new Map()
  const taskIdRegex = /\b(T-\d+[a-z]?)\b/gi
  const otherIdRegex = /\b(EST-\d+[a-z]?|DMM-\d+[a-z]?|C-\d+[a-z]?|ORQ-\d+[a-z]?|M-\d+[a-z]?|L-\d+[a-z]?)\b/gi

  for (const s of sessions) {
    const ids = new Set()
    let m
    while ((m = taskIdRegex.exec(s.title)) !== null) ids.add(m[1].toUpperCase())
    while ((m = otherIdRegex.exec(s.title)) !== null) ids.add(m[1].toUpperCase())
    for (const id of ids) {
      if (!index.has(id)) index.set(id, [])
      index.get(id).push({
        sessionId: s.id,
        title: s.title,
        messageCount: s.message_count,
        promptTokens: s.prompt_tokens,
        completionTokens: s.completion_tokens,
        createdAt: s.created_at
      })
    }
  }
  return index
}

function main() {
  let db = null
  let dbSizeBefore = null
  let dbMtimeBefore = null

  try {
    dbSizeBefore = statSync(DB_PATH).size
    dbMtimeBefore = statSync(DB_PATH).mtimeMs
    db = new DatabaseSync(DB_PATH, { open: true, readOnly: true })
  } catch {
    // DB is optional enrichment. Without it, sessions are empty and the
    // deterministic filter still runs (offline/offline tests).
    db = null
  }

  const files = readdirSync(CORPUS_DIR).filter(f => f.endsWith('.md'))
  const sessionIndex = db ? buildSessionIndex(db) : new Map()

  const candidates = []
  const stats = {
    totalTasks: 0,
    totalSessions: 0,
    tasksWithFindings: 0,
    totalFindings: 0,
    findingsByMarker: {},
    tasksWithSection6: 0,
    tasksWithSection8: 0,
    tasksWithRework: 0,
    tasksWithSession: 0,
    tasksWithoutSession: 0,
    candidatesEmitted: 0,
    candidatesDropped: 0,
    dropReasons: {}
  }

  if (db) {
    stats.totalSessions = db.prepare('SELECT COUNT(*) as c FROM sessions').get().c
  }

  for (const file of files) {
    stats.totalTasks++
    const filePath = join(CORPUS_DIR, file)
    const text = readFileSync(filePath, 'utf8')
    const fm = parseFrontmatter(text)
    if (!fm.id) continue

    const taskId = fm.id
    const { sections, contentLines } = extractSections(text)
    const objetivo = findObjective(contentLines)
    const specFeedback = findSpecFeedback(contentLines)
    const findings = extractFindings(sections, contentLines, text)

    if (specFeedback) stats.tasksWithSection6++
    if (Object.keys(sections).some(k => /^8\./.test(k))) stats.tasksWithSection8++
    if (Object.keys(sections).some(k => {
      const s8 = sections[k]
      return s8 && s8.subsections && Object.keys(s8.subsections).some(ss => /rework/i.test(ss))
    })) stats.tasksWithRework++

    const sessions = sessionIndex.get(taskId.toUpperCase()) || []
    if (sessions.length > 0) { stats.tasksWithSession++ } else { stats.tasksWithoutSession++ }

    if (findings.length > 0) stats.tasksWithFindings++

    for (const finding of findings) {
      stats.totalFindings++
      const markerLetter = finding.marker[0]
      stats.findingsByMarker[markerLetter] = (stats.findingsByMarker[markerLetter] || 0) + 1

      const citation = buildCitation(filePath, taskId, finding)

      if (!citation) {
        stats.candidatesDropped++
        const reason = 'missing-citation'
        stats.dropReasons[reason] = (stats.dropReasons[reason] || 0) + 1
        continue
      }

      const candidate = {
        taskId,
        objetivo: objetivo ? objetivo.substring(0, 800) : null,
        finding: {
          marker: finding.marker,
          severity: finding.severity,
          text: finding.text
        },
        sourceType: finding.sourceType,
        reworkRound: finding.reworkRound,
        specFeedback: specFeedback || null,
        citation,
        sessions: sessions.map(s => ({ title: s.title, messageCount: s.messageCount }))
      }

      candidates.push(candidate)
      stats.candidatesEmitted++
    }
  }

  if (db) db.close()

  let dbSizeAfter = null
  let dbMtimeAfter = null
  let corpusFileUnchanged = null
  if (dbSizeBefore !== null) {
    dbSizeAfter = statSync(DB_PATH).size
    dbMtimeAfter = statSync(DB_PATH).mtimeMs
    corpusFileUnchanged = dbSizeBefore === dbSizeAfter && dbMtimeBefore === dbMtimeAfter
  }

  const result = {
    meta: {
      corpusFileSizeBefore: dbSizeBefore,
      corpusFileSizeAfter: dbSizeAfter,
      corpusFileMtimeBefore: dbMtimeBefore !== null ? new Date(dbMtimeBefore).toISOString() : null,
      corpusFileMtimeAfter: dbMtimeAfter !== null ? new Date(dbMtimeAfter).toISOString() : null,
      corpusFileUnchanged
    },
    stats,
    candidates
  }

  const out = JSON.stringify(result, null, 2)
  if (OUTPUT) {
    writeFileSync(OUTPUT, out)
  }
  console.log(out)
}

main()
