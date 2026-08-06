import { describe, expect, it, vi } from 'vitest'
import { listOpenCodeSessions } from './client'
import type { OpenCodeServeHandle } from '../providers/opencode-headless-dispatch'

describe('listOpenCodeSessions', () => {
  it('returns empty sessions list without error when no serves are registered', async () => {
    const getServes = vi.fn<() => OpenCodeServeHandle[]>(() => [])
    const createClient = vi.fn()

    const result = await listOpenCodeSessions(getServes, createClient)

    expect(result).toEqual({ sessions: [] })
    expect(getServes).toHaveBeenCalledOnce()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('enumerates registered per-worktree serves and attributes worktree info to sessions', async () => {
    const handles: OpenCodeServeHandle[] = [
      {
        url: 'http://127.0.0.1:40001',
        port: 40001,
        worktreeId: 'DEVX-044',
        worktreeDir: 'C:\\Dev2026\\worktrees\\DEVX-044',
        reused: false,
        proc: null,
        startedAt: Date.now()
      },
      {
        url: 'http://127.0.0.1:40002',
        port: 40002,
        worktreeId: 'DEVX-048',
        worktreeDir: 'C:\\Dev2026\\worktrees\\DEVX-048',
        reused: true,
        proc: null,
        startedAt: Date.now()
      }
    ]

    const getServes = vi.fn<() => OpenCodeServeHandle[]>(() => handles)
    const createClient = vi.fn((url: string) => {
      if (url === 'http://127.0.0.1:40001') {
        return {
          session: {
            list: async () => [
              { id: 'sess-1', title: 'Task 44 Run', time: { created: 100, updated: 200 } }
            ]
          }
        } as any
      }
      return {
        session: {
          list: async () => [
            { id: 'sess-2', title: 'Task 48 Run', time: { created: 300, updated: 400 } }
          ]
        }
      } as any
    })

    const result = await listOpenCodeSessions(getServes, createClient)

    expect(result.error).toBeUndefined()
    expect(result.sessions).toEqual([
      {
        id: 'sess-1',
        title: 'Task 44 Run',
        createdAt: 100,
        updatedAt: 200,
        worktreeId: 'DEVX-044',
        worktreeDir: 'C:\\Dev2026\\worktrees\\DEVX-044'
      },
      {
        id: 'sess-2',
        title: 'Task 48 Run',
        createdAt: 300,
        updatedAt: 400,
        worktreeId: 'DEVX-048',
        worktreeDir: 'C:\\Dev2026\\worktrees\\DEVX-048'
      }
    ])
  })

  it('captures error when a registered serve fails to respond', async () => {
    const handles: OpenCodeServeHandle[] = [
      {
        url: 'http://127.0.0.1:49999',
        port: 49999,
        worktreeId: 'DEVX-999',
        worktreeDir: 'C:\\Dev2026\\worktrees\\DEVX-999',
        reused: false,
        proc: null,
        startedAt: Date.now()
      }
    ]

    const getServes = vi.fn<() => OpenCodeServeHandle[]>(() => handles)
    const createClient = vi.fn(() => ({
      session: {
        list: async () => {
          throw new Error('Connection refused')
        }
      }
    })) as any

    const result = await listOpenCodeSessions(getServes, createClient)

    expect(result.sessions).toEqual([])
    expect(result.error).toContain('DEVX-999 (http://127.0.0.1:49999): Connection refused')
  })
})
