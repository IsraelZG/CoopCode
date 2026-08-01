import type { AuditResult, Claim, RunResult } from './types'

const FAMILY_COMMAND_KEYWORDS: Record<string, RegExp> = {
  test: /(^|\s)(test|vitest|jest|mocha|jasmine)(\s|$)/i,
  lint: /(^|\s)(lint|oxlint|eslint)(\s|$)/i,
  typecheck: /(^|\s)(typecheck|tsc|type-check|tc)(\s|$)/i,
  build: /(^|\s)(build|compile|tsc)(\s|$)/i,
  doctor: /(^|\s)(doctor)(\s|$)/i,
  release: /(^|\s)(release|publish)(\s|$)/i
}

function findMatchingRuns(claim: Claim, runs: RunResult[]): RunResult[] {
  const keyword = FAMILY_COMMAND_KEYWORDS[claim.family]
  if (!keyword) return []
  return runs.filter((run) => keyword.test(run.command))
}

export function auditClaims(claims: Claim[], runs: RunResult[]): AuditResult[] {
  return claims.map((claim) => {
    const matchingRuns = findMatchingRuns(claim, runs)

    if (matchingRuns.length === 0) {
      if (claim.passed) {
        return {
          claim,
          status: 'unsupported',
          ok: false,
          message: `claimed ${claim.family} passed but no ${claim.family} evidence was recorded`
        }
      }
      return {
        claim,
        status: 'unsupported',
        ok: false,
        message: `claimed ${claim.family} failed but no ${claim.family} evidence was recorded`
      }
    }

    const allPassed = matchingRuns.every((run) => run.exitCode === 0)

    if (claim.passed && allPassed) {
      return {
        claim,
        status: 'supported',
        ok: true,
        message: `${claim.family} evidence recorded with exit code 0`
      }
    }

    if (claim.passed && !allPassed) {
      return {
        claim,
        status: 'unsupported',
        ok: false,
        message: `claimed ${claim.family} passed but evidence shows non-zero exit code`
      }
    }

    return {
      claim,
      status: 'supported',
      ok: true,
      message: `${claim.family} failure confirmed by evidence`
    }
  })
}

export function auditSession(runs: RunResult[], claims: Claim[]): AuditResult[] {
  return auditClaims(claims, runs)
}
