import type { EvidenceSession } from './session'
import type { GateArtifactOptions, GateArtifactV1, GateResult } from './types'

export function createGateArtifact(
  session: EvidenceSession,
  options: GateArtifactOptions & { resultSha: string }
): GateArtifactV1 {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch

  const gates: GateResult[] = session.runs.map((run) => ({
    command: run.command,
    purpose: '',
    exitCode: run.exitCode,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    stdout: run.stdout,
    stderr: run.stderr
  }))

  return {
    task: options.task,
    attempt: options.attempt,
    baseSha: options.baseSha,
    resultSha: options.resultSha,
    platform,
    arch,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt ?? session.startedAt,
    nodeVersion: options.nodeVersion ?? process.version,
    gates
  }
}
