import { describe, expect, it } from 'vitest'
import { auditClaims, EvidenceSession } from './index'

describe('EvidenceSession', () => {
  it('creates a session with unique id and start timestamp', () => {
    const session = new EvidenceSession()
    expect(session.id).toBeTruthy()
    expect(session.id.length).toBeGreaterThan(0)
    expect(session.startedAt).toBeTruthy()
    expect(session.finishedAt).toBeNull()
    expect(session.runs).toEqual([])
    expect(session.claims).toEqual([])
  })

  it('ends the session sets finishedAt', () => {
    const session = new EvidenceSession()
    session.end()
    expect(session.finishedAt).toBeTruthy()
    expect(session.finishedAt).not.toBeNull()
  })

  it('summary returns session state', () => {
    const session = new EvidenceSession()
    const summary = session.summary()
    expect(summary.id).toBe(session.id)
    expect(summary.startedAt).toBe(session.startedAt)
    expect(summary.finishedAt).toBeNull()
    expect(summary.runs).toEqual([])
    expect(summary.claims).toEqual([])
  })
})

describe('run', () => {
  it('captures a command with exit code and output', async () => {
    const session = new EvidenceSession()
    const result = await session.run('echo hello')

    expect(result.command).toBe('echo hello')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('hello')
    expect(result.startedAt).toBeTruthy()
    expect(result.finishedAt).toBeTruthy()
    expect(session.runs).toHaveLength(1)
  })

  it('captures non-zero exit codes', async () => {
    const session = new EvidenceSession()
    const result = await session.run('cmd /c exit 1')

    expect(result.exitCode).toBe(1)
  })

  it('truncates long output', async () => {
    const session = new EvidenceSession()
    const longLine = 'x'.repeat(15000)
    const result = await session.run(`cmd /c echo ${longLine}`)

    expect(result.stdout.length).toBeLessThan(15000)
  })
})

describe('claim', () => {
  it('registers a claim by family', () => {
    const session = new EvidenceSession()
    const claim = session.claim('test', true)

    expect(claim.family).toBe('test')
    expect(claim.passed).toBe(true)
    expect(claim.startedAt).toBeTruthy()
    expect(claim.finishedAt).toBeTruthy()
    expect(session.claims).toHaveLength(1)
  })

  it('registers multiple claims', () => {
    const session = new EvidenceSession()
    session.claim('test', true)
    session.claim('lint', false)
    session.claim('typecheck', true)

    expect(session.claims).toHaveLength(3)
    const families = session.claims.map((c) => c.family)
    expect(families).toEqual(['test', 'lint', 'typecheck'])
  })
})

describe('audit — acceptance criteria from Critério 3', () => {
  it('control: claim passed with matching run audits as supported', () => {
    const runs = [
      {
        command: 'vitest run',
        exitCode: 0,
        stdout: 'all tests passed',
        stderr: '',
        startedAt: '2026-07-31T00:00:00.000Z',
        finishedAt: '2026-07-31T00:01:00.000Z'
      }
    ]
    const claims = [
      {
        family: 'test' as const,
        passed: true,
        startedAt: '2026-07-31T00:01:00.000Z',
        finishedAt: '2026-07-31T00:01:00.000Z'
      }
    ]

    const results = auditClaims(claims, runs)

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('supported')
    expect(results[0].ok).toBe(true)
  })

  it('adversarial: claim passed without matching run audits as unsupported', () => {
    const runs: Array<{
      command: string
      exitCode: number
      stdout: string
      stderr: string
      startedAt: string
      finishedAt: string
    }> = []
    const claims = [
      {
        family: 'test' as const,
        passed: true,
        startedAt: '2026-07-31T00:01:00.000Z',
        finishedAt: '2026-07-31T00:01:00.000Z'
      }
    ]

    const results = auditClaims(claims, runs)

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('unsupported')
    expect(results[0].ok).toBe(false)
    expect(results[0].message).toContain('no test evidence was recorded')
  })

  it('claim failed with matching failed run audits as supported', () => {
    const runs = [
      {
        command: 'vitest run',
        exitCode: 1,
        stdout: '',
        stderr: 'tests failed',
        startedAt: '2026-07-31T00:00:00.000Z',
        finishedAt: '2026-07-31T00:01:00.000Z'
      }
    ]
    const claims = [
      {
        family: 'test' as const,
        passed: false,
        startedAt: '2026-07-31T00:01:00.000Z',
        finishedAt: '2026-07-31T00:01:00.000Z'
      }
    ]

    const results = auditClaims(claims, runs)

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('supported')
    expect(results[0].ok).toBe(true)
  })

  it('claim passed but matching run failed audits as unsupported', () => {
    const runs = [
      {
        command: 'vitest run',
        exitCode: 1,
        stdout: '',
        stderr: 'tests failed',
        startedAt: '2026-07-31T00:00:00.000Z',
        finishedAt: '2026-07-31T00:01:00.000Z'
      }
    ]
    const claims = [
      {
        family: 'test' as const,
        passed: true,
        startedAt: '2026-07-31T00:01:00.000Z',
        finishedAt: '2026-07-31T00:01:00.000Z'
      }
    ]

    const results = auditClaims(claims, runs)

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('unsupported')
    expect(results[0].ok).toBe(false)
    expect(results[0].message).toContain('non-zero exit code')
  })

  it('matches claims to runs by family keyword in command', () => {
    const runs = [
      { command: 'vitest run', exitCode: 0, stdout: '', stderr: '', startedAt: 't', finishedAt: 't' },
      { command: 'oxlint src/', exitCode: 0, stdout: '', stderr: '', startedAt: 't', finishedAt: 't' }
    ]
    const claims = [
      { family: 'test' as const, passed: true, startedAt: 't', finishedAt: 't' },
      { family: 'lint' as const, passed: true, startedAt: 't', finishedAt: 't' }
    ]

    const results = auditClaims(claims, runs)

    expect(results[0].status).toBe('supported')
    expect(results[1].status).toBe('supported')
  })

  it('all supported claim families', () => {
    const claims = [
      { family: 'test' as const, passed: true, startedAt: 't', finishedAt: 't' },
      { family: 'lint' as const, passed: true, startedAt: 't', finishedAt: 't' },
      { family: 'typecheck' as const, passed: true, startedAt: 't', finishedAt: 't' },
      { family: 'build' as const, passed: true, startedAt: 't', finishedAt: 't' },
      { family: 'doctor' as const, passed: true, startedAt: 't', finishedAt: 't' },
      { family: 'release' as const, passed: true, startedAt: 't', finishedAt: 't' }
    ]
    const runs = [
      { command: 'vitest run', exitCode: 0, stdout: '', stderr: '', startedAt: 't', finishedAt: 't' },
      { command: 'oxlint src/', exitCode: 0, stdout: '', stderr: '', startedAt: 't', finishedAt: 't' },
      { command: 'tsc --noEmit', exitCode: 0, stdout: '', stderr: '', startedAt: 't', finishedAt: 't' },
      { command: 'npm run build', exitCode: 0, stdout: '', stderr: '', startedAt: 't', finishedAt: 't' },
      { command: 'pnpm run doctor', exitCode: 0, stdout: '', stderr: '', startedAt: 't', finishedAt: 't' },
      { command: 'npm publish --dry-run', exitCode: 0, stdout: '', stderr: '', startedAt: 't', finishedAt: 't' }
    ]

    const results = auditClaims(claims, runs)

    for (const result of results) {
      expect(result.status).toBe('supported')
      expect(result.ok).toBe(true)
    }
  })
})

describe('auditSession convenience', () => {
  it('audits claims from session data', async () => {
    const { auditSession } = await import('./audit')

    const runs = [
      {
        command: 'vitest run',
        exitCode: 0,
        stdout: 'all tests passed',
        stderr: '',
        startedAt: 't',
        finishedAt: 't'
      }
    ]
    const claims = [
      {
        family: 'test' as const,
        passed: true,
        startedAt: 't',
        finishedAt: 't'
      }
    ]

    const results = auditSession(runs, claims)

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('supported')
    expect(results[0].ok).toBe(true)
  })
})
