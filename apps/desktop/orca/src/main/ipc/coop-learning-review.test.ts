import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock } = vi.hoisted(() => ({
  handleMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: handleMock }
}))

import {
  discoverRepoRoot,
  loadVerdicts,
  parseExtractorCandidates,
  parseReportCandidates,
  registerCoopLearningReviewHandlers,
  replayCitation,
  resolveCitationInText,
  saveVerdicts
} from './coop-learning-review'
import type { LearningCandidateVerdict } from '../../shared/coop-learning-review'

// Fixture mirroring tools/corpus-learning/fixtures/fx-reviewer-finding.md, the
// exact shape extract-candidates.mjs emits for a bold reviewer finding.
const EXTRACTOR_SAMPLE = {
  meta: { corpusFileUnchanged: true },
  stats: { candidatesEmitted: 4 },
  candidates: [
    {
      taskId: 'FX-001',
      objetivo: 'Implementar a função `parsePrimary` para consumir exatamente um token por literal.',
      finding: {
        marker: 'B1',
        severity: 'BLOCKER',
        text: 'Bug em `parsePrimary`: double-consume em string literals quebra expressões compostas com `&&`/`||`.'
      },
      sourceType: 'reviewer-finding',
      reworkRound: null,
      specFeedback: '> Nenhuma decisão em aberto.',
      citation: {
        file: 'C:\\Dev2026\\Docs\\tasks\\FX-001.md',
        section: '## 8. Log de Handover e Revisão Agile (Code Review) > ### Parecer do Agente Revisor (Reviewer):',
        grep: '\\[B1\\]'
      },
      sessions: []
    },
    {
      taskId: 'FX-001',
      objetivo: 'Implementar a função `parsePrimary` para consumir exatamente um token por literal.',
      finding: {
        marker: 'M1',
        severity: 'MAJOR',
        text: 'Teste 7 não cobre o caso de string literal seguida de operador.'
      },
      sourceType: 'reviewer-finding',
      reworkRound: null,
      specFeedback: null,
      citation: {
        file: 'C:\\Dev2026\\Docs\\tasks\\FX-001.md',
        section: '## 8. Log de Handover e Revisão Agile (Code Review) > ### Parecer do Agente Revisor (Reviewer):',
        grep: '\\[M1\\]'
      },
      sessions: []
    }
  ]
}

const FIXTURE_TASK_MD = `---
id: FX-001
title: "Fixture de finding de revisor em negrito"
status: done
complexity: 2
target_agent: logic_agent
reviewer_agent: agile_reviewer
---

# FX-001 · Fixture de finding de revisor

## 1. Objetivo
Implementar a função \`parsePrimary\` para consumir exatamente um token por literal.

## 6. Feedback de Especificação
### Decisões em aberto
- NENHUMA decisão pendente.

## 8. Log de Handover e Revisão Agile (Code Review)

### Handover do Executor:
\`\`\`
✅ build | exit=0
✅ test | exit=0
\`\`\`

### Parecer do Agente Revisor (Reviewer):
**[B1] BLOCKER — Bug em \`parsePrimary\`: double-consume em string literals quebra expressões compostas com \`&&\`/\`||\`.**
**[M1] MAJOR — Teste 7 não cobre o caso de string literal seguida de operador.**

### Rework (deepseek, 2026-07-18 14:53 BRT):
- [B1] double-consume removido em \`evaluator.ts:208-211\`
- [M1] Teste 7 agora assere \`expected false, got true\`
`

const REPORT_SAMPLE = `# DEVX-025 · Tool/MCP/LSP usage analytics from the Crush session corpus

## Reprodução
\`\`\`
rtk node --no-warnings tools/corpus-learning/extract-tool-usage-stats.mjs
\`\`\`

---

## Achado 1 — \`edit\` falha em 16.6% das chamadas; o motivo não é "falha às vezes" (critério 2)

Das 5 056 chamadas de \`edit\`, 840 retornaram erro (16.6%).

## Candidatos PITFALLS-ready (critério 5)

### Candidato P-??-DEVX-025-1 · \`edit\` falha por stale-read em working tree compartilhado

**Sintoma:** \`edit\` recusa com "file ... has been modified since it was last
read" — 478 de 840 falhas de edit (56.9%); concentrado em \`tasks/T-0NN.md\`.

**Causa raiz:** o repo de controle é um working tree único na \`master\` com
vários agentes em paralelo; o mtime do arquivo muda entre o \`view\` e o \`edit\`
do mesmo agente, e o guard rejeita por design (proteção correta, acionada em
excesso pelo modelo de paralelismo).

**Evidência:** 840 erros classificados, 0 unclassified; mensagens
\`2224b121-d227-4156-bfaa-5ead03ad1f84\` e \`828a7395-2fc4-43e7-86dd-9e4a6f50b96c\`
consultáveis por \`SELECT id, session_id, parts FROM messages WHERE id='<id>'\`.

**Como prevenir recorrência (candidato):** re-\`view\` antes de re-\`edit\` quando
o guard acionar (retry com re-leitura) — comportamento de harness, decisão
humana.

### Candidato P-??-DEVX-025-2 · \`edit\` exige match byte-exato; drift de whitespace quebra

**Sintoma:** "old_string not found in file. Make sure it matches exactly,
including whitespace" — 216/840 (25.7%).

**Causa raiz:** a ferramenta exige reprodução byte-exata (espaços, indentação,
CRLF); modelos menores derivam do texto visto (espelham \`view\` que normaliza
algo, ou erram contagem de espaços).

**Evidência:** mensagens \`d8471be8-a4ee-4bea-93f4-01abe1ae908a\`,
\`5e7c7afc-ff1f-47df-bdc4-4caa8e14a5c6\`.

**Como prevenir recorrência (candidato):** re-\`view\` do trecho exato antes do
retry; \`multiedit\` com mais contexto; aceitar menor diff.
`

describe('coop-learning-review parsers', () => {
  it('parses extract-candidates.mjs JSON into review candidates', () => {
    const candidates = parseExtractorCandidates(EXTRACTOR_SAMPLE, 'DEVX-023')
    expect(candidates).toHaveLength(2)
    const first = candidates[0]
    expect(first.origin).toBe('extractor')
    expect(first.source).toBe('DEVX-023')
    expect(first.taskId).toBe('FX-001')
    expect(first.ruleText).toContain('double-consume em string literals')
    expect(first.excerpt).toContain('double-consume em string literals')
    expect(first.citation?.file).toBe('C:\\Dev2026\\Docs\\tasks\\FX-001.md')
    expect(first.citation?.grep).toBe('\\[B1\\]')
    expect(first.citation?.section).toContain('Parecer do Agente Revisor')
    expect(first.extra?.severity).toBe('BLOCKER')
  })

  it('ignores malformed extractor payloads without throwing', () => {
    expect(parseExtractorCandidates(null, 'DEVX-023')).toEqual([])
    expect(parseExtractorCandidates({}, 'DEVX-023')).toEqual([])
    expect(parseExtractorCandidates({ candidates: 'nope' }, 'DEVX-023')).toEqual([])
    expect(parseExtractorCandidates({ candidates: [null, 42] }, 'DEVX-023')).toEqual([])
  })

  it('parses DEVX-025 report candidate blocks into review candidates', () => {
    const candidates = parseReportCandidates(REPORT_SAMPLE, 'DEVX-025')
    expect(candidates).toHaveLength(2)
    const first = candidates[0]
    expect(first.origin).toBe('report')
    expect(first.ruleText).toContain('re-`view` antes de re-`edit`')
    expect(first.excerpt).toContain('file ... has been modified since it was last read')
    expect(first.citation).toBeNull()
    expect(first.extra?.title).toContain('edit` falha por stale-read')
    expect(first.extra?.evidencia).toContain('2224b121-d227-4156-bfaa-5ead03ad1f84')
  })
})

describe('resolveCitationInText', () => {
  const fixtureLines = FIXTURE_TASK_MD.split('\n')
  const b1Line = fixtureLines.findIndex((line) => line.includes('[B1]')) + 1

  it('locates the cited section and grep marker, rendering original context', () => {
    const result = resolveCitationInText(FIXTURE_TASK_MD, {
      section: '## 8. Log de Handover e Revisão Agile (Code Review) > ### Parecer do Agente Revisor (Reviewer):',
      grep: '\\[B1\\]'
    })
    expect(result.ok).toBe(true)
    expect(result.sectionHeading).toBe('Parecer do Agente Revisor (Reviewer):')
    expect(result.matchLine).toBe(b1Line)
    const rendered = result.contextLines.join('\n')
    expect(rendered).toContain('double-consume em string literals')
    expect(rendered).toContain(`${b1Line}: **[B1]`)
  })

  it('falls back to section context when the grep marker is absent', () => {
    const result = resolveCitationInText(FIXTURE_TASK_MD, {
      section: '## 8. Log de Handover e Revisão Agile (Code Review) > ### Handover do Executor:'
    })
    expect(result.ok).toBe(true)
    expect(result.sectionHeading).toBe('Handover do Executor:')
    expect(result.matchLine).toBeUndefined()
    expect(result.contextLines.join('\n')).toContain('✅ build | exit=0')
  })

  it('greps the whole file when the section heading is unknown', () => {
    const result = resolveCitationInText(FIXTURE_TASK_MD, { grep: '\\[M1\\]' })
    expect(result.ok).toBe(true)
    expect(result.sectionHeading).toBeUndefined()
    expect(result.contextLines.join('\n')).toContain('Teste 7 não cobre')
  })

  it('reports failure when neither heading nor grep match', () => {
    const result = resolveCitationInText(FIXTURE_TASK_MD, {
      section: '## 99. Inexistente > ### Também não existe',
      grep: '\\[Z9\\]'
    })
    expect(result.ok).toBe(false)
    expect(result.contextLines).toEqual([])
  })
})

describe('replayCitation', () => {
  let dir: string
  let filePath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'coop-learning-review-'))
    filePath = join(dir, 'FX-001.md')
    writeFileSync(filePath, FIXTURE_TASK_MD, 'utf8')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('opens the real file and replays the citation from disk', () => {
    const result = replayCitation({
      file: filePath,
      section: '## 8. Log de Handover e Revisão Agile (Code Review) > ### Parecer do Agente Revisor (Reviewer):',
      grep: '\\[B1\\]'
    })
    expect(result.ok).toBe(true)
    expect(result.file).toBe(filePath)
    expect(result.matchLine).toBe(FIXTURE_TASK_MD.split('\n').findIndex((l) => l.includes('[B1]')) + 1)
    expect(result.contextLines.join('\n')).toContain('double-consume em string literals')
  })

  it('returns an error result when the cited file is missing', () => {
    const result = replayCitation({ file: join(dir, 'missing.md'), grep: '\\[B1\\]' })
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(result.contextLines).toEqual([])
  })

  it('rejects traversal segments in relative citation paths', () => {
    const result = replayCitation({ file: '../escape.md' })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('traversal')
  })
})

describe('verdict durability', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'coop-learning-verdicts-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('persists verdicts and reloads them unchanged (close/reopen durability)', () => {
    const source = 'DEVX-025'
    expect(loadVerdicts(source, dir)).toEqual({})

    const first: Record<string, LearningCandidateVerdict> = {
      'FX-001::B1::0': 'accepted',
      'FX-001::M1::1': 'rejected'
    }
    const path = saveVerdicts(source, first, dir)
    expect(existsSync(path)).toBe(true)

    const reloaded = loadVerdicts(source, dir)
    expect(reloaded).toEqual(first)

    // Reopen and mark a third candidate: prior marks survive.
    const reopened = loadVerdicts(source, dir)
    reopened['DEVX-025::report::0'] = 'pending'
    saveVerdicts(source, reopened, dir)
    expect(loadVerdicts(source, dir)).toEqual({
      'FX-001::B1::0': 'accepted',
      'FX-001::M1::1': 'rejected',
      'DEVX-025::report::0': 'pending'
    })
  })

  it('ignores invalid verdict values on load', () => {
    writeFileSync(
      join(dir, 'DEVX-025-candidate-verdicts.json'),
      JSON.stringify({ verdicts: { a: 'accepted', b: 'nope' } }),
      'utf8'
    )
    expect(loadVerdicts('DEVX-025', dir)).toEqual({ a: 'accepted' })
  })

  it('tolerates a corrupt verdicts file', () => {
    writeFileSync(join(dir, 'DEVX-023-candidate-verdicts.json'), '{oops', 'utf8')
    expect(loadVerdicts('DEVX-023', dir)).toEqual({})
  })
})

describe('discoverRepoRoot', () => {
  it('finds the repo root containing docs/planning/evidence', () => {
    const root = discoverRepoRoot()
    expect(root).toBeTruthy()
    expect(existsSync(join(root ?? '', 'docs', 'planning', 'evidence'))).toBe(true)
  })
})

describe('coop-learning-review IPC handlers', () => {
  beforeEach(() => {
    handleMock.mockReset()
  })

  it('registers load, replay and setVerdict handlers', () => {
    registerCoopLearningReviewHandlers()
    const channels = handleMock.mock.calls.map((call) => call[0])
    expect(channels).toContain('coopLearningReview:load')
    expect(channels).toContain('coopLearningReview:replay')
    expect(channels).toContain('coopLearningReview:setVerdict')
  })

  it('setVerdict handler persists and returns the updated verdict map', async () => {
    registerCoopLearningReviewHandlers()
    const setVerdictHandler = handleMock.mock.calls.find(
      (call) => call[0] === 'coopLearningReview:setVerdict'
    )?.[1] as (event: unknown, args: {
      source: string
      candidateId: string
      verdict: LearningCandidateVerdict
      rootDir: string
    }) => Promise<unknown>
    expect(setVerdictHandler).toBeTypeOf('function')

    const dir = mkdtempSync(join(tmpdir(), 'coop-learning-ipc-'))
    try {
      const result = (await setVerdictHandler(undefined, {
        source: 'DEVX-025',
        candidateId: 'DEVX-025::report::1',
        verdict: 'accepted',
        rootDir: dir
      })) as { ok: boolean; verdicts: Record<string, LearningCandidateVerdict>; path: string }
      expect(result.ok).toBe(true)
      expect(result.verdicts['DEVX-025::report::1']).toBe('accepted')
      expect(existsSync(join(dir, 'docs', 'planning', 'evidence', 'DEVX-025-candidate-verdicts.json'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects an invalid verdict value', async () => {
    registerCoopLearningReviewHandlers()
    const setVerdictHandler = handleMock.mock.calls.find(
      (call) => call[0] === 'coopLearningReview:setVerdict'
    )?.[1] as (event: unknown, args: unknown) => Promise<unknown>
    const dir = mkdtempSync(join(tmpdir(), 'coop-learning-ipc-'))
    try {
      const result = (await setVerdictHandler(undefined, {
        source: 'DEVX-025',
        candidateId: 'x',
        verdict: 'maybe',
        rootDir: dir
      })) as { ok: boolean; error: string }
      expect(result.ok).toBe(false)
      expect(result.error).toContain('invalid verdict')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
