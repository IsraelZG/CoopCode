// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenCodeSession, OpenCodeSdkListSessionsResult } from '../../../../shared/opencode-sdk-types'
import OpenCodeSessionsScreen, { OPENCODE_SESSIONS_OPEN_EVENT } from './OpenCodeSessionsScreen'

const listSessionsMock = vi.hoisted(() => vi.fn())

function installApiMock(overrides: Partial<Record<'listSessions', unknown>> = {}): void {
  window.api = {
    openCodeSdk: {
      listSessions: overrides.listSessions ?? listSessionsMock
    }
  } as never
}

const roots: Root[] = []

async function renderScreen(): Promise<void> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(createElement(OpenCodeSessionsScreen))
  })
}

async function openScreen(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new Event(OPENCODE_SESSIONS_OPEN_EVENT))
  })
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

const SESSION: OpenCodeSession = {
  id: 'session-1',
  title: 'Fix the sealing logic',
  mode: 'build'
}

const SESSIONS_RESULT: OpenCodeSdkListSessionsResult = {
  sessions: [SESSION]
}

beforeEach(() => {
  vi.clearAllMocks()
  installApiMock()
  listSessionsMock.mockResolvedValue(SESSIONS_RESULT)
})

afterEach(() => {
  for (const root of roots) {
    root.unmount()
  }
  roots.length = 0
  document.body.innerHTML = ''
})

describe('OpenCodeSessionsScreen', () => {
  it('renders nothing until the open event fires', async () => {
    await renderScreen()
    expect(document.body.textContent ?? '').not.toContain('OpenCode Sessions')
    await openScreen()
    expect(document.body.textContent).toContain('OpenCode Sessions')
  })

  it('fetches sessions when opened and lists them', async () => {
    await renderScreen()
    await openScreen()
    await flushEffects()
    expect(listSessionsMock).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).toContain('Fix the sealing logic')
    expect(document.body.textContent).toContain('build')
  })

  it('closes on the close button and removes the DOM node', async () => {
    await renderScreen()
    await openScreen()
    await flushEffects()
    expect(document.body.textContent).toContain('OpenCode Sessions')
    const closeButton = [...document.querySelectorAll('button')].find((button) =>
      button.getAttribute('aria-label')?.includes('Close OpenCode sessions')
    )
    expect(closeButton).toBeTruthy()
    await act(async () => {
      closeButton!.click()
    })
    expect(document.body.textContent ?? '').not.toContain('OpenCode Sessions')
  })

  it('closes on Escape while open', async () => {
    await renderScreen()
    await openScreen()
    await flushEffects()
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(document.body.textContent ?? '').not.toContain('OpenCode Sessions')
  })

  it('shows the empty state when no sessions exist', async () => {
    listSessionsMock.mockResolvedValue({ sessions: [] })
    await renderScreen()
    await openScreen()
    await flushEffects()
    expect(document.body.textContent).toContain('No active OpenCode dispatches')
  })

  it('shows the load error state from the IPC result', async () => {
    listSessionsMock.mockResolvedValue({ sessions: [], error: 'cannot reach opencode serve' })
    await renderScreen()
    await openScreen()
    await flushEffects()
    expect(document.body.textContent).toContain('cannot reach opencode serve')
  })
})