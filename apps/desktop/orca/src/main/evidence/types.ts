export type ClaimFamily = 'test' | 'lint' | 'typecheck' | 'build' | 'doctor' | 'release'

export interface RunResult {
  command: string
  exitCode: number
  stdout: string
  stderr: string
  startedAt: string
  finishedAt: string
}

export interface Claim {
  family: ClaimFamily
  passed: boolean
  startedAt: string
  finishedAt: string
}

export interface AuditResult {
  claim: Claim
  status: 'supported' | 'unsupported'
  ok: boolean
  message: string
}

export interface SessionSummary {
  id: string
  startedAt: string
  finishedAt: string | null
  runs: RunResult[]
  claims: Claim[]
}

export interface GateArtifactV1 {
  task: string
  attempt: number
  baseSha: string
  resultSha: string
  platform: string
  arch: string
  startedAt: string
  finishedAt: string
  nodeVersion?: string
  gates: GateResult[]
  logs?: FileRef[]
  artifacts?: FileRef[]
  baseline?: string
  regressions?: string
  outOfScopeDiff?: string
}

export interface GateResult {
  command: string
  purpose: string
  exitCode: number
  startedAt: string
  finishedAt: string
  stdout?: string
  stderr?: string
  criteria?: GateCriterion[]
}

export interface GateCriterion {
  description: string
  passed: boolean
  detail?: string
}

export interface FileRef {
  path: string
  sha256: string
}

export interface GateArtifactOptions {
  task: string
  attempt: number
  baseSha: string
  resultSha: string
  platform?: string
  arch?: string
  nodeVersion?: string
}
