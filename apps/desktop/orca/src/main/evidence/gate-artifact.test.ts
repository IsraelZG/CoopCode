import { describe, expect, it } from 'vitest'
import { createGateArtifact, EvidenceSession } from './index'

describe('createGateArtifact', () => {
  it('produces a gate-artifact-v1 compatible object from a session', async () => {
    const session = new EvidenceSession()
    await session.run('echo hello')
    session.end()

    const artifact = createGateArtifact(session, {
      task: 'DEVX-011',
      attempt: 1,
      baseSha: '6967e632bf7ea721f47fa8c3cf05a25e7ed1feb7',
      resultSha: '0000000000000000000000000000000000000000',
      platform: 'win32',
      arch: 'arm64'
    })

    expect(artifact.task).toBe('DEVX-011')
    expect(artifact.attempt).toBe(1)
    expect(artifact.baseSha).toBe('6967e632bf7ea721f47fa8c3cf05a25e7ed1feb7')
    expect(artifact.resultSha).toBe('0000000000000000000000000000000000000000')
    expect(artifact.platform).toBe('win32')
    expect(artifact.arch).toBe('arm64')
    expect(artifact.startedAt).toBeTruthy()
    expect(artifact.finishedAt).toBeTruthy()
    expect(artifact.nodeVersion).toBeTruthy()
    expect(artifact.gates).toHaveLength(1)
    expect(artifact.gates[0].command).toBe('echo hello')
    expect(artifact.gates[0].exitCode).toBe(0)
    expect(artifact.gates[0].startedAt).toBeTruthy()
    expect(artifact.gates[0].finishedAt).toBeTruthy()
  })

  it('defaults platform and arch from process', () => {
    const session = new EvidenceSession()
    session.end()

    const artifact = createGateArtifact(session, {
      task: 'DEVX-011',
      attempt: 1,
      baseSha: '6967e632bf7ea721f47fa8c3cf05a25e7ed1feb7',
      resultSha: '0000000000000000000000000000000000000000'
    })

    expect(artifact.platform).toBe(process.platform)
    expect(artifact.arch).toBe(process.arch)
  })

  it('maps each run to a gate entry', async () => {
    const session = new EvidenceSession()
    await session.run('echo first')
    await session.run('echo second')
    session.end()

    const artifact = createGateArtifact(session, {
      task: 'DEVX-011',
      attempt: 1,
      baseSha: '6967e632bf7ea721f47fa8c3cf05a25e7ed1feb7',
      resultSha: '0000000000000000000000000000000000000000'
    })

    expect(artifact.gates).toHaveLength(2)
    expect(artifact.gates[0].command).toBe('echo first')
    expect(artifact.gates[1].command).toBe('echo second')
  })

  it('produces all required gate-artifact-v1 fields', () => {
    const session = new EvidenceSession()
    session.end()

    const sha = '6967e632bf7ea721f47fa8c3cf05a25e7ed1feb7'

    const artifact = createGateArtifact(session, {
      task: 'DEVX-011',
      attempt: 1,
      baseSha: sha,
      resultSha: sha
    })

    const requiredFields = [
      'task', 'attempt', 'baseSha', 'resultSha',
      'platform', 'arch', 'startedAt', 'finishedAt', 'gates'
    ]
    for (const field of requiredFields) {
      expect(artifact).toHaveProperty(field)
    }

    expect(typeof artifact.task).toBe('string')
    expect(artifact.task.length).toBeGreaterThan(0)
    expect(typeof artifact.attempt).toBe('number')
    expect(artifact.attempt).toBeGreaterThanOrEqual(1)
    expect(artifact.baseSha).toMatch(/^[0-9a-f]{40}$/)
    expect(artifact.resultSha).toMatch(/^[0-9a-f]{40}$/)
    expect(Array.isArray(artifact.gates)).toBe(true)
  })

  it('supports criteria', async () => {
    const session = new EvidenceSession()
    await session.run('echo test')
    session.end()

    const artifact = createGateArtifact(session, {
      task: 'DEVX-011',
      attempt: 1,
      baseSha: '6967e632bf7ea721f47fa8c3cf05a25e7ed1feb7',
      resultSha: '0000000000000000000000000000000000000000'
    })

    artifact.gates[0].criteria = [
      { description: 'All tests pass', passed: true },
      { description: 'Coverage above 80%', passed: false, detail: 'Coverage is 75%' }
    ]

    expect(artifact.gates[0].criteria).toHaveLength(2)
    expect(artifact.gates[0].criteria[0].description).toBe('All tests pass')
    expect(artifact.gates[0].criteria[0].passed).toBe(true)
    expect(artifact.gates[0].criteria[1].detail).toBe('Coverage is 75%')
  })
})
