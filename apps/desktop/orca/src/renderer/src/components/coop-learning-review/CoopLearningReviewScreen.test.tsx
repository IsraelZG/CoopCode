// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CoopLearningReviewLoadResult,
  LearningCandidate,
  ReplayCitationResult
} from '../../../../shared/coop-learning-review'
import CoopLearningReviewScreen, {
  COOP_LEARNING_REVIEW_OPEN_EVENT
} from './CoopLearningReviewScreen'

const loadMock = vi.hoisted(() => vi.fn())
const replayMock = vi.hoisted(() => vi.fn())
const setVerdictMock = vi.hoisted(() => vi.fn())

function installApiMock(overrides: Partial<Record<'load' | 'replay' | 'setVerdict', unknown>> = {}): void {
  window.api = {
    coopLearningReview: {
      load: overrides.load ?? loadMock,
      replay: overrides.replay ?? replayMock,
      setVerdict: overrides.setVerdict ?? setVerdictMock
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
    root.render(createElement(CoopLearningReviewScreen))
  })
}

async function openScreen(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new Event(COOP_LEARNING_REVIEW_OPEN_EVENT))
  })
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

const EXTRACTOR_CANDIDATE: LearningCandidate = {
  id: 'FX-001::B1::0',
  origin: 'extractor',
  source: 'DEVX-023',
  taskId: 'FX-001',
  ruleText: 'Bug em `parsePrimary`: double-consume em string literals quebra expressões compostas.',
  excerpt: 'Bug em `parsePrimary`',
  citation: {
    file: 'C:\\Dev2026\\Docs\\tasks\\FX-001.md',
    section: '## 8. Log de Handover e Revisão Agile (Code Review) > ### Parecer do Agente Revisor (Reviewer):',
    grep: '\\[B1\\]'
  }
}

const LOAD_RESULT: CoopLearningReviewLoadResult = {
  ok: true,
  candidates: [EXTRACTOR_CANDIDATE],
  verdicts: {},
  evidenceDir: 'C:\\repo\\docs\\planning\\evidence'
}

const REPLAY_RESULT: ReplayCitationResult = {
  ok: true,
  file: 'C:\\Dev2026\\Docs\\tasks\\FX-001.md',
  sectionHeading: 'Parecer do Agente Revisor (Reviewer):',
  matchLine: 28,
  contextLines: ['27: ### Parecer do Agente Revisor (Reviewer):', '28: **[B1] BLOCKER — Bug em `parsePrimary`…**']
}

beforeEach(() => {
  vi.clearAllMocks()
  installApiMock()
  loadMock.mockResolvedValue(LOAD_RESULT)
  replayMock.mockResolvedValue(REPLAY_RESULT)
  setVerdictMock.mockResolvedValue({
    ok: true,
    verdicts: { [EXTRACTOR_CANDIDATE.id]: 'accepted' },
    path: 'DEVX-023-candidate-verdicts.json'
  })
})

afterEach(() => {
  for (const root of roots) {
    root.unmount()
  }
  roots.length = 0
  document.body.innerHTML = ''
})

describe('CoopLearningReviewScreen', () => {
  it('renders nothing until the open event fires', async () => {
    await renderScreen()
    expect(document.body.textContent ?? '').not.toContain('Revisão de candidatos')
    await openScreen()
    expect(document.body.textContent).toContain('Revisão de candidatos de aprendizado de corpus')
  })

  it('lists candidates with rule text, citation summary and source', async () => {
    await renderScreen()
    await openScreen()
    await flushEffects()
    expect(loadMock).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).toContain('double-consume em string literals')
    expect(document.body.textContent).toContain('Extrator (DEVX-023)')
    expect(document.body.textContent).toContain('Parecer do Agente Revisor')
  })

  it('replays the selected citation and renders the original context', async () => {
    await renderScreen()
    await openScreen()
    await flushEffects()
    const replayButtons = [...document.querySelectorAll('button')].filter((button) =>
      button.textContent?.includes('Reabrir citação')
    )
    expect(replayButtons).toHaveLength(1)
    await act(async () => {
      replayButtons[0].click()
    })
    expect(replayMock).toHaveBeenCalledWith({ citation: EXTRACTOR_CANDIDATE.citation })
    expect(document.body.textContent).toContain('28: **[B1]')
  })

  it('persists a verdict through the IPC bridge and shows the mark', async () => {
    await renderScreen()
    await openScreen()
    await flushEffects()
    const acceptButton = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Aceitar')
    )
    expect(acceptButton).toBeTruthy()
    await act(async () => {
      acceptButton!.click()
    })
    expect(setVerdictMock).toHaveBeenCalledWith({
      source: 'DEVX-023',
      candidateId: EXTRACTOR_CANDIDATE.id,
      verdict: 'accepted'
    })
    expect(document.body.textContent).toContain('Aceito')
  })

  it('shows the load error state when no candidate source exists', async () => {
    loadMock.mockResolvedValue({
      ok: false,
      candidates: [],
      verdicts: {},
      evidenceDir: 'C:\\repo\\docs\\planning\\evidence',
      error: 'no candidate sources found'
    })
    await renderScreen()
    await openScreen()
    await flushEffects()
    expect(document.body.textContent).toContain('no candidate sources found')
  })
})
