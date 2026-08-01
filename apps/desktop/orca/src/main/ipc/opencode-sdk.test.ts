import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock } = vi.hoisted(() => ({
  handleMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: handleMock }
}))

vi.mock('../opencode-sdk/client', () => ({
  listOpenCodeSessions: vi.fn()
}))

import { listOpenCodeSessions } from '../opencode-sdk/client'
import { registerOpenCodeSdkHandlers } from './opencode-sdk'

const mockListSessions = vi.mocked(listOpenCodeSessions)

describe('OpenCode SDK IPC', () => {
  beforeEach(() => {
    handleMock.mockReset()
    mockListSessions.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('registers opencodeSdk:listSessions handler', () => {
    registerOpenCodeSdkHandlers()
    expect(handleMock).toHaveBeenCalledWith('opencodeSdk:listSessions', expect.any(Function))
  })

  it('handler returns parsed sessions from client', async () => {
    registerOpenCodeSdkHandlers()
    const handler = handleMock.mock.calls[0][1]

    mockListSessions.mockResolvedValueOnce({
      sessions: [
        { id: 's1', title: 'My Session', mode: 'code', createdAt: 1000, updatedAt: 2000 }
      ]
    })

    const result = await handler()
    expect(result).toEqual({
      sessions: [
        { id: 's1', title: 'My Session', mode: 'code', createdAt: 1000, updatedAt: 2000 }
      ]
    })
  })

  it('handler returns error when client fails', async () => {
    registerOpenCodeSdkHandlers()
    const handler = handleMock.mock.calls[0][1]

    mockListSessions.mockResolvedValueOnce({
      sessions: [],
      error: 'Connection refused'
    })

    const result = await handler()
    expect(result.sessions).toEqual([])
    expect(result.error).toBe('Connection refused')
  })

  it('handler returns empty sessions on empty list', async () => {
    registerOpenCodeSdkHandlers()
    const handler = handleMock.mock.calls[0][1]

    mockListSessions.mockResolvedValueOnce({ sessions: [] })

    const result = await handler()
    expect(result.sessions).toEqual([])
    expect(result.error).toBeUndefined()
  })
})
