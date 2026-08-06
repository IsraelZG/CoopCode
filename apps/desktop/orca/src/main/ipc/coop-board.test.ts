import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock } = vi.hoisted(() => ({
  handleMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: handleMock }
}))

import { loadCoopBoard, registerCoopBoardHandlers } from './coop-board'

let repoRoot: string

async function writeTask(id: string, fields: Record<string, unknown>, body = ''): Promise<void> {
  const title = fields.title ?? `${id} task`
  const frontmatter = {
    id,
    title,
    state: 'ready',
    priority: 'P2',
    risk: 'routine',
    depends_on: [],
    blocked_on: [],
    ...fields
  }
  await writeFile(
    path.join(repoRoot, 'docs', 'coop', 'tasks', `${id}.md`),
    `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n\n# ${id} · ${title}\n\n${body}`,
    'utf8'
  )
}

async function createRepoFixture(): Promise<void> {
  repoRoot = await mkdtemp(path.join(os.tmpdir(), 'orca-coop-board-'))
  await mkdir(path.join(repoRoot, 'docs', 'coop', 'tasks'), { recursive: true })
}

describe('Coop board read model', () => {
  beforeEach(async () => {
    handleMock.mockReset()
    await createRepoFixture()
  })

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true })
  })

  it('parses task frontmatter and the trailing integration section', async () => {
    await writeTask(
      'DEVX-001',
      {
        state: 'done',
        priority: 'P1',
        depends_on: ['DEVX-000'],
        blocked_on: ['external access']
      },
      [
        '## Integration',
        '',
        '- Review decision: `accept`',
        '- Result SHA: `0123456789abcdef0123456789abcdef01234567`',
        '- Merge commit: `abcdef123`'
      ].join('\n')
    )

    const result = await loadCoopBoard({ repoRoot, worktreePorcelain: '' })

    expect(result.error).toBeUndefined()
    expect(result.tasks).toEqual([
      expect.objectContaining({
        id: 'DEVX-001',
        title: 'DEVX-001 task',
        state: 'done',
        frontmatterState: 'done',
        priority: 'P1',
        risk: 'routine',
        dependsOn: ['DEVX-000'],
        blockedOn: ['external access'],
        integration: {
          reviewDecision: 'accept',
          resultSha: '0123456789abcdef0123456789abcdef01234567',
          mergeCommit: 'abcdef123'
        }
      })
    ])
  })

  it('classifies a non-done task as working when its task branch has a worktree', async () => {
    await writeTask('DEVX-024', { state: 'ready' })
    await writeTask('DEVX-025', { state: 'done' })

    const result = await loadCoopBoard({
      repoRoot,
      worktreePorcelain: [
        'worktree C:/Dev2026/worktrees/CoopCode/DEVX-024',
        'HEAD 1111111111111111111111111111111111111111',
        'branch refs/heads/task/devx-024',
        '',
        'worktree C:/Dev2026/worktrees/CoopCode/DEVX-025',
        'HEAD 2222222222222222222222222222222222222222',
        'branch refs/heads/task/devx-025',
        ''
      ].join('\n')
    })

    expect(result.tasks.find((task) => task.id === 'DEVX-024')).toEqual(
      expect.objectContaining({
        state: 'working',
        frontmatterState: 'ready',
        worktreePath: 'C:/Dev2026/worktrees/CoopCode/DEVX-024',
        branch: 'refs/heads/task/devx-024'
      })
    )
    expect(result.tasks.find((task) => task.id === 'DEVX-025')).toEqual(
      expect.objectContaining({ state: 'done', frontmatterState: 'done' })
    )
  })

  it('classifies any task id shape (not just devx-N) as working via its task branch worktree', async () => {
    await writeTask('PLAT-013', { state: 'ready' })
    await writeTask('DEVX-040', { state: 'ready' })

    const result = await loadCoopBoard({
      repoRoot,
      worktreePorcelain: [
        'worktree C:/Dev2026/worktrees/CoopCode/PLAT-013',
        'HEAD 3333333333333333333333333333333333333333',
        'branch refs/heads/task/plat-013',
        '',
        'worktree C:/Dev2026/worktrees/CoopCode/DEVX-040',
        'HEAD 4444444444444444444444444444444444444444',
        'branch refs/heads/task/devx-040',
        ''
      ].join('\n')
    })

    expect(result.tasks.find((task) => task.id === 'PLAT-013')).toEqual(
      expect.objectContaining({
        state: 'working',
        frontmatterState: 'ready',
        worktreePath: 'C:/Dev2026/worktrees/CoopCode/PLAT-013',
        branch: 'refs/heads/task/plat-013'
      })
    )
    expect(result.tasks.find((task) => task.id === 'DEVX-040')).toEqual(
      expect.objectContaining({ state: 'working', frontmatterState: 'ready' })
    )
  })

  it('computes dependency blocking from computed dependency states', async () => {
    await writeTask('DEVX-001', { state: 'done' })
    await writeTask('DEVX-002', { state: 'ready' })
    await writeTask('DEVX-003', { state: 'ready', depends_on: ['DEVX-001', 'DEVX-002'] })
    await writeTask('DEVX-004', { state: 'ready', depends_on: ['DEVX-999'] })

    const result = await loadCoopBoard({ repoRoot, worktreePorcelain: '' })

    expect(result.tasks.find((task) => task.id === 'DEVX-003')).toEqual(
      expect.objectContaining({
        blocked: true,
        blockingReasons: ['DEVX-002 is ready']
      })
    )
    expect(result.tasks.find((task) => task.id === 'DEVX-004')).toEqual(
      expect.objectContaining({
        blocked: true,
        blockingReasons: ['Missing dependency DEVX-999']
      })
    )
  })

  it('registers a read-only list handler that requires repoRoot', async () => {
    registerCoopBoardHandlers()
    expect(handleMock).toHaveBeenCalledWith('coopBoard:listTasks', expect.any(Function))

    const handler = handleMock.mock.calls[0][1]
    const result = await handler({}, {})

    expect(result).toEqual({ repoRoot: '', tasks: [], error: 'repoRoot is required' })
  })

  it('lists evidence files matching task ID prefix case-insensitively', async () => {
    await writeTask('DEVX-040', { state: 'ready' })
    const evidenceDir = path.join(repoRoot, 'docs', 'planning', 'evidence')
    await mkdir(evidenceDir, { recursive: true })
    await writeFile(path.join(evidenceDir, 'DEVX-040-gate.json'), '{"gate": "ok"}', 'utf8')
    await writeFile(path.join(evidenceDir, 'devx-040-board.png'), 'fake-png-content', 'utf8')

    const result = await loadCoopBoard({ repoRoot, worktreePorcelain: '' })
    const task = result.tasks.find((t) => t.id === 'DEVX-040')

    expect(task?.evidenceFiles).toHaveLength(2)
    expect(task?.evidenceFiles).toEqual([
      expect.objectContaining({
        name: 'devx-040-board.png',
        extension: 'png',
        fileType: 'image'
      }),
      expect.objectContaining({
        name: 'DEVX-040-gate.json',
        extension: 'json',
        fileType: 'json'
      })
    ])
    expect(task?.evidenceMissing).toBe(false)
  })

  it('flags task as evidenceMissing when hands-on evidence is claimed but no file exists', async () => {
    await writeTask(
      'DEVX-042',
      { state: 'ready' },
      '## Acceptance\n\n- [ ] Hands-on evidence: run against this repo real state'
    )

    const result = await loadCoopBoard({ repoRoot, worktreePorcelain: '' })
    const task = result.tasks.find((t) => t.id === 'DEVX-042')

    expect(task?.evidenceClaimed).toBe(true)
    expect(task?.evidenceFiles).toHaveLength(0)
    expect(task?.evidenceMissing).toBe(true)
  })
})

