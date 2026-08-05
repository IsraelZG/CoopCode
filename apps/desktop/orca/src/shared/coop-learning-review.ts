// Cross-layer contract for the corpus-learning candidate review surface (DEVX-043).
// The main process parses candidates, replays citations and persists verdicts;
// the renderer only ever sees these shapes over the preload bridge.

export type LearningCandidateVerdict = 'accepted' | 'rejected' | 'pending'

export type LearningCandidateOrigin = 'extractor' | 'report'

export type LearningCitation = {
  /** Absolute path, or a path relative to the repo root. */
  file?: string
  /** Best-effort heading path, e.g. "## 8. … > ### Parecer do Agente Revisor (Reviewer)". */
  section?: string
  /** Regex source that locates the marker inside the section (e.g. "\\[B1\\]"). */
  grep?: string
}

export type LearningCandidate = {
  /** Stable key for verdict persistence; unique per source. */
  id: string
  origin: LearningCandidateOrigin
  /** Source task id (e.g. DEVX-025) used to derive the verdicts filename. */
  source: string
  taskId?: string
  /** The proposed rule text a human reviews. */
  ruleText: string
  /** The short extracted excerpt the candidate was produced from. */
  excerpt?: string
  citation: LearningCitation | null
  extra?: Record<string, unknown>
}

export type ReplayCitationResult = {
  ok: boolean
  /** Resolved file path that was read. */
  file?: string
  /** Heading text of the section that was located, without the markdown markers. */
  sectionHeading?: string
  /** 1-based line number where the grep marker matched inside the section. */
  matchLine?: number
  /** Rendered original context, each entry prefixed with its 1-based line number. */
  contextLines: string[]
  error?: string
}

export type CoopLearningReviewLoadArgs = {
  /** Overrides the default source task id used for verdicts persistence. */
  source?: string
  /** Candidate JSON produced by extract-candidates.mjs. Defaults to <root>/tools/corpus-learning/candidates.json. */
  candidatesPath?: string
  /** Markdown report with structured candidate blocks. Defaults to <root>/docs/planning/evidence/DEVX-025-tool-usage-report.md. */
  reportPath?: string
  /** Repo root used to resolve relative paths. Defaults to auto-discovery from cwd. */
  rootDir?: string
}

export type CoopLearningReviewLoadResult = {
  ok: boolean
  candidates: LearningCandidate[]
  verdicts: Record<string, LearningCandidateVerdict>
  evidenceDir: string
  error?: string
}

export type CoopLearningReviewReplayArgs = {
  citation: LearningCitation
  rootDir?: string
}

export type CoopLearningReviewSetVerdictArgs = {
  source: string
  candidateId: string
  verdict: LearningCandidateVerdict
  rootDir?: string
}

export type CoopLearningReviewSetVerdictResult = {
  ok: boolean
  verdicts: Record<string, LearningCandidateVerdict>
  path: string
  error?: string
}

export const LEARNING_CANDIDATE_VERDICTS: readonly LearningCandidateVerdict[] = [
  'accepted',
  'rejected',
  'pending'
]

export function isLearningCandidateVerdict(value: unknown): value is LearningCandidateVerdict {
  return (
    typeof value === 'string' &&
    (LEARNING_CANDIDATE_VERDICTS as readonly string[]).includes(value)
  )
}
