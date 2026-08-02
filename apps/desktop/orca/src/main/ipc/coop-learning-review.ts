import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { ipcMain } from 'electron'
import {
  isLearningCandidateVerdict,
  type CoopLearningReviewLoadArgs,
  type CoopLearningReviewLoadResult,
  type CoopLearningReviewReplayArgs,
  type CoopLearningReviewSetVerdictArgs,
  type CoopLearningReviewSetVerdictResult,
  type LearningCandidate,
  type LearningCandidateVerdict,
  type LearningCitation,
  type ReplayCitationResult
} from '../../shared/coop-learning-review'

const DEFAULT_EXTRACTOR_CANDIDATES_REL = join('tools', 'corpus-learning', 'candidates.json')
const DEFAULT_DEVX025_REPORT_REL = join('docs', 'planning', 'evidence', 'DEVX-025-tool-usage-report.md')
const DEFAULT_SOURCE_FOR_EXTRACTOR = 'DEVX-023'
const DEFAULT_SOURCE_FOR_REPORT = 'DEVX-025'

/** Finds the repo root by walking up from a start dir looking for docs/planning/evidence. */
export function discoverRepoRoot(startDir: string = process.cwd()): string | null {
  let current = resolve(startDir)
  for (;;) {
    if (existsSync(join(current, 'docs', 'planning', 'evidence'))) {
      return current
    }
    const parent = dirname(current)
    if (parent === current) {
      return null
    }
    current = parent
  }
}

function resolveRootDir(rootDir: string | undefined): string {
  if (rootDir) {
    return resolve(rootDir)
  }
  return discoverRepoRoot() ?? process.cwd()
}

function verdictsFilePathFor(source: string, evidenceDir: string): string {
  return join(evidenceDir, `${source}-candidate-verdicts.json`)
}

export function loadVerdicts(source: string, evidenceDir: string): Record<string, LearningCandidateVerdict> {
  const filePath = verdictsFilePathFor(source, evidenceDir)
  if (!existsSync(filePath)) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
    if (parsed === null || typeof parsed !== 'object') {
      return {}
    }
    const map = 'verdicts' in parsed ? (parsed as { verdicts: unknown }).verdicts : parsed
    if (map === null || typeof map !== 'object' || Array.isArray(map)) {
      return {}
    }
    const result: Record<string, LearningCandidateVerdict> = {}
    for (const [id, verdict] of Object.entries(map as Record<string, unknown>)) {
      if (isLearningCandidateVerdict(verdict)) {
        result[id] = verdict
      }
    }
    return result
  } catch {
    return {}
  }
}

export function saveVerdicts(
  source: string,
  verdicts: Record<string, LearningCandidateVerdict>,
  evidenceDir: string
): string {
  mkdirSync(evidenceDir, { recursive: true })
  const filePath = verdictsFilePathFor(source, evidenceDir)
  const payload = {
    source,
    updatedAt: new Date().toISOString(),
    verdicts
  }
  const tmpPath = `${filePath}.tmp`
  writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  renameSync(tmpPath, filePath)
  return filePath
}

function stripMarkdownMarkers(text: string): string {
  return text.replace(/^\s*#{1,6}\s+/, '').trim()
}

function normalizeHeading(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

function headingLinesOf(text: string): { line: number; level: number; text: string }[] {
  const headings: { line: number; level: number; text: string }[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      headings.push({ line: i, level: match[1].length, text: stripMarkdownMarkers(match[2]) })
    }
  }
  return headings
}

function resolveSectionRange(
  lines: string[],
  headings: { line: number; level: number; text: string }[],
  section: string
): { startLine: number; endLine: number; resolvedHeading: string | null } {
  const tokens = section
    .split('>')
    .map((token) => stripMarkdownMarkers(token))
    .filter((token) => token.length > 0)

  let cursor = 0
  let startLine = 0
  let endLevel = 2
  let resolvedHeading: string | null = null

  for (const token of tokens) {
    const normalizedToken = normalizeHeading(token)
    let foundIndex = -1
    for (let i = cursor; i < headings.length; i++) {
      if (normalizeHeading(headings[i].text) === normalizedToken) {
        foundIndex = i
        break
      }
    }
    if (foundIndex === -1) {
      // Best-effort: fall back to the most specific heading resolved so far so
      // the human still sees the closest surrounding context.
      if (resolvedHeading === null) {
        return { startLine: 0, endLine: lines.length, resolvedHeading: null }
      }
      return { startLine, endLine: lines.length, resolvedHeading }
    }
    const heading = headings[foundIndex]
    if (cursor === 0) {
      startLine = heading.line
    }
    // The most specific (last) token in the citation names the section the
    // human should be looking at — that is the resolved heading.
    resolvedHeading = heading.text
    cursor = foundIndex + 1
    endLevel = heading.level
  }

  if (resolvedHeading === null) {
    return { startLine: 0, endLine: lines.length, resolvedHeading: null }
  }

  let endLine = lines.length
  for (let i = cursor; i < headings.length; i++) {
    if (headings[i].level <= endLevel) {
      endLine = headings[i].line
      break
    }
  }
  return { startLine, endLine, resolvedHeading }
}

function findMatchInRange(
  lines: string[],
  startLine: number,
  endLine: number,
  grep: string | undefined
): number | null {
  if (!grep) {
    return null
  }
  let matcher: RegExp
  try {
    matcher = new RegExp(grep)
  } catch {
    matcher = new RegExp(grep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  }
  const slice = lines.slice(startLine, endLine)
  for (let i = 0; i < slice.length; i++) {
    if (matcher.test(slice[i])) {
      return startLine + i
    }
  }
  return null
}

function renderContext(
  lines: string[],
  startLine: number,
  endLine: number,
  matchLine: number | null
): string[] {
  let windowStart = startLine
  let windowEnd = endLine
  const MAX_WINDOW = 80
  if (windowEnd - windowStart > MAX_WINDOW) {
    if (matchLine !== null) {
      windowStart = Math.max(startLine, matchLine - 12)
      windowEnd = Math.min(endLine, matchLine + 13)
    } else {
      windowEnd = windowStart + MAX_WINDOW
    }
  }
  const rendered: string[] = []
  for (let i = windowStart; i < windowEnd; i++) {
    rendered.push(`${i + 1}: ${lines[i]}`)
  }
  return rendered
}

/** Pure, fs-free citation replay used by tests and by replayCitation(). */
export function resolveCitationInText(
  text: string,
  citation: LearningCitation
): Pick<ReplayCitationResult, 'sectionHeading' | 'matchLine' | 'contextLines'> & { ok: boolean } {
  const normalized = text.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const headings = headingLinesOf(normalized)

  let startLine = 0
  let endLine = lines.length
  let sectionHeading: string | null = null

  if (citation.section) {
    const range = resolveSectionRange(lines, headings, citation.section)
    startLine = range.startLine
    endLine = range.endLine
    sectionHeading = range.resolvedHeading
  }

  const matchLine = findMatchInRange(lines, startLine, endLine, citation.grep)
  const ok = sectionHeading !== null || matchLine !== null
  if (!ok) {
    return { ok: false, sectionHeading: undefined, matchLine: undefined, contextLines: [] }
  }
  return {
    ok,
    sectionHeading: sectionHeading ?? undefined,
    matchLine: matchLine !== null ? matchLine + 1 : undefined,
    contextLines: renderContext(lines, startLine, endLine, matchLine)
  }
}

function hasTraversalSegment(filePath: string): boolean {
  return filePath.split(/[\\/]+/).includes('..')
}

export function replayCitation(citation: LearningCitation, rootDir?: string): ReplayCitationResult {
  if (!citation.file) {
    return { ok: false, contextLines: [], error: 'citation has no file to open' }
  }
  if (!isAbsolute(citation.file) && hasTraversalSegment(citation.file)) {
    return { ok: false, contextLines: [], error: `refusing to open path with traversal segment: ${citation.file}` }
  }
  const filePath = isAbsolute(citation.file) ? citation.file : resolve(resolveRootDir(rootDir), citation.file)
  let text: string
  try {
    text = readFileSync(filePath, 'utf8')
  } catch (error) {
    return {
      ok: false,
      file: filePath,
      contextLines: [],
      error: error instanceof Error ? error.message : String(error)
    }
  }
  const resolved = resolveCitationInText(text, citation)
  return { ...resolved, file: filePath }
}

function extractorCandidateId(taskId: string, index: number, marker?: string): string {
  const markerPart = marker ? `::${marker}` : ''
  return `${taskId}${markerPart}::${index}`
}

export function parseExtractorCandidates(json: unknown, source: string): LearningCandidate[] {
  if (json === null || typeof json !== 'object' || !('candidates' in json)) {
    return []
  }
  const rawCandidates = (json as { candidates: unknown }).candidates
  if (!Array.isArray(rawCandidates)) {
    return []
  }
  const candidates: LearningCandidate[] = []
  let index = 0
  for (const raw of rawCandidates) {
    if (raw === null || typeof raw !== 'object') {
      continue
    }
    const item = raw as {
      taskId?: unknown
      finding?: unknown
      sourceType?: unknown
      reworkRound?: unknown
      specFeedback?: unknown
      objetivo?: unknown
      citation?: unknown
    }
    const finding =
      item.finding !== null && typeof item.finding === 'object'
        ? (item.finding as { marker?: unknown; severity?: unknown; text?: unknown })
        : null
    const findingText = typeof finding?.text === 'string' ? finding.text : ''
    const marker = typeof finding?.marker === 'string' ? finding.marker : undefined
    const taskId = typeof item.taskId === 'string' ? item.taskId : `candidate-${index}`
    const citationRaw = item.citation
    const citation: LearningCitation | null =
      citationRaw !== null && typeof citationRaw === 'object'
        ? {
            file: typeof (citationRaw as { file?: unknown }).file === 'string' ? (citationRaw as { file: string }).file : undefined,
            section:
              typeof (citationRaw as { section?: unknown }).section === 'string'
                ? (citationRaw as { section: string }).section
                : undefined,
            grep: typeof (citationRaw as { grep?: unknown }).grep === 'string' ? (citationRaw as { grep: string }).grep : undefined
          }
        : null

    const excerpt = findingText || (typeof item.objetivo === 'string' ? item.objetivo : undefined)
    candidates.push({
      id: extractorCandidateId(taskId, index, marker),
      origin: 'extractor',
      source,
      taskId,
      ruleText: findingText,
      excerpt,
      citation: citation?.file ? citation : null,
      extra: {
        marker,
        severity: typeof finding?.severity === 'string' ? finding.severity : undefined,
        sourceType: typeof item.sourceType === 'string' ? item.sourceType : undefined,
        reworkRound: typeof item.reworkRound === 'string' ? item.reworkRound : undefined
      }
    })
    index++
  }
  return candidates
}

const REPORT_CANDIDATE_HEADING = /^#{2,6}\s+Candidato\s+(.+?)\s*·\s*(.+?)\s*$/
const REPORT_FIELD =
  /\*\*(Sintoma|Causa raiz|Evidência|Como prevenir recorrência \(candidato\)|Como prevenir recorrência):\*\*\s*([\s\S]*?)(?=\n\*\*|\n#{1,6}\s|$)/g

export function parseReportCandidates(markdown: string, source: string): LearningCandidate[] {
  const candidates: LearningCandidate[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  let current: { marker: string; title: string; body: string[] } | null = null

  const flush = (): void => {
    if (current === null) {
      return
    }
    const { marker, title, body } = current
    const block = body.join('\n')
    const fields = new Map<string, string>()
    const fieldRegex = new RegExp(REPORT_FIELD.source, REPORT_FIELD.flags)
    let fieldMatch: RegExpExecArray | null
    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      fields.set(fieldMatch[1], fieldMatch[2].replace(/\s*\n\s*/g, ' ').trim())
    }

    const sintoma = fields.get('Sintoma')
    const causa = fields.get('Causa raiz')
    const evidencia = fields.get('Evidência')
    const prevention =
      fields.get('Como prevenir recorrência (candidato)') ?? fields.get('Como prevenir recorrência')
    const ruleText = prevention || sintoma || title

    candidates.push({
      id: `${source}::report::${candidates.length}`,
      origin: 'report',
      source,
      taskId: source,
      ruleText,
      excerpt: sintoma,
      citation: null,
      extra: {
        markerToken: marker,
        title,
        sintoma,
        causa,
        evidencia
      }
    })
  }

  for (const line of lines) {
    const match = line.match(REPORT_CANDIDATE_HEADING)
    if (match) {
      flush()
      current = { marker: match[1].trim(), title: match[2].trim(), body: [] }
    } else if (current !== null) {
      current.body.push(line)
    }
  }
  flush()
  return candidates
}

function loadCandidates(args: CoopLearningReviewLoadArgs, rootDir: string): {
  candidates: LearningCandidate[]
  missingSources: string[]
} {
  const candidates: LearningCandidate[] = []
  const missingSources: string[] = []

  if (args.candidatesPath !== undefined || existsSync(join(rootDir, DEFAULT_EXTRACTOR_CANDIDATES_REL))) {
    const candidatesPath = args.candidatesPath
      ? resolve(rootDir, args.candidatesPath)
      : join(rootDir, DEFAULT_EXTRACTOR_CANDIDATES_REL)
    if (existsSync(candidatesPath)) {
      let parsed: unknown = null
      try {
        parsed = JSON.parse(readFileSync(candidatesPath, 'utf8'))
      } catch {
        parsed = null
      }
      candidates.push(...parseExtractorCandidates(parsed, args.source ?? DEFAULT_SOURCE_FOR_EXTRACTOR))
    } else {
      missingSources.push(candidatesPath)
    }
  }

  if (args.reportPath !== undefined || existsSync(join(rootDir, DEFAULT_DEVX025_REPORT_REL))) {
    const reportPath = args.reportPath
      ? resolve(rootDir, args.reportPath)
      : join(rootDir, DEFAULT_DEVX025_REPORT_REL)
    if (existsSync(reportPath)) {
      candidates.push(...parseReportCandidates(readFileSync(reportPath, 'utf8'), args.source ?? DEFAULT_SOURCE_FOR_REPORT))
    } else {
      missingSources.push(reportPath)
    }
  }

  return { candidates, missingSources }
}

function loadResultFromArgs(args: CoopLearningReviewLoadArgs): CoopLearningReviewLoadResult {
  const rootDir = resolveRootDir(args.rootDir)
  const evidenceDir = join(rootDir, 'docs', 'planning', 'evidence')
  const { candidates, missingSources } = loadCandidates(args, rootDir)

  if (candidates.length === 0) {
    const detail = missingSources.length > 0 ? ` missing: ${missingSources.join(', ')}` : ''
    return {
      ok: false,
      candidates: [],
      verdicts: {},
      evidenceDir,
      error: `no candidate sources found${detail}`
    }
  }

  const verdicts: Record<string, LearningCandidateVerdict> = {}
  const sources = new Set(candidates.map((candidate) => candidate.source))
  for (const source of sources) {
    Object.assign(verdicts, loadVerdicts(source, evidenceDir))
  }
  return { ok: true, candidates, verdicts, evidenceDir }
}

export function registerCoopLearningReviewHandlers(): void {
  ipcMain.handle('coopLearningReview:load', (_event, args?: CoopLearningReviewLoadArgs) =>
    loadResultFromArgs(args ?? {})
  )
  ipcMain.handle(
    'coopLearningReview:replay',
    (_event, args: CoopLearningReviewReplayArgs): ReplayCitationResult =>
      replayCitation(args.citation, args.rootDir)
  )
  ipcMain.handle(
    'coopLearningReview:setVerdict',
    (_event, args: CoopLearningReviewSetVerdictArgs): CoopLearningReviewSetVerdictResult => {
      const rootDir = resolveRootDir(args.rootDir)
      const evidenceDir = join(rootDir, 'docs', 'planning', 'evidence')
      if (!isLearningCandidateVerdict(args.verdict)) {
        return {
          ok: false,
          verdicts: {},
          path: verdictsFilePathFor(args.source, evidenceDir),
          error: `invalid verdict: ${String(args.verdict)}`
        }
      }
      const verdicts = loadVerdicts(args.source, evidenceDir)
      verdicts[args.candidateId] = args.verdict
      const path = saveVerdicts(args.source, verdicts, evidenceDir)
      return { ok: true, verdicts, path: basename(path) }
    }
  )
}

export {
  resolveRootDir,
  verdictsFilePathFor,
  headingLinesOf,
  resolveSectionRange,
  DEFAULT_EXTRACTOR_CANDIDATES_REL,
  DEFAULT_DEVX025_REPORT_REL
}
