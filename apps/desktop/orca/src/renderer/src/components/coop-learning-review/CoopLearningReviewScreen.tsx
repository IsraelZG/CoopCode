import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, BookOpen, Check, ExternalLink, Loader2, RefreshCw, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type {
  CoopLearningReviewLoadResult,
  LearningCandidate,
  LearningCandidateVerdict,
  ReplayCitationResult
} from '../../../../shared/coop-learning-review'

export const COOP_LEARNING_REVIEW_OPEN_EVENT = 'coop-learning-review:open'

const VERDICT_STYLE: Record<LearningCandidateVerdict, string> = {
  accepted: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  rejected: 'bg-destructive/10 text-destructive border-destructive/40',
  pending: 'bg-muted text-muted-foreground border-border'
}

const VERDICT_LABEL: Record<LearningCandidateVerdict, string> = {
  accepted: 'Aceito',
  rejected: 'Rejeitado',
  pending: 'Pendente'
}

function citationSummary(candidate: LearningCandidate): string {
  const citation = candidate.citation
  if (!citation) {
    return 'Sem citação de arquivo (candidato de relatório)'
  }
  const file = citation.file ?? '(arquivo desconhecido)'
  if (citation.section) {
    const heading = citation.section.split('>').pop()?.trim()
    return `${file} · ${heading ?? citation.section}`
  }
  return file
}

type ScreenState = {
  load: CoopLearningReviewLoadResult | null
  replay: Record<string, ReplayCitationResult>
  replayingId: string | null
  error: string | null
  verdicts: Record<string, LearningCandidateVerdict>
}

export default function CoopLearningReviewScreen(): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [state, setState] = useState<ScreenState>({
    load: null,
    replay: {},
    replayingId: null,
    error: null,
    verdicts: {}
  })

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setState((prev) => ({ ...prev, error: null }))
    try {
      const result = (await window.api.coopLearningReview.load()) as CoopLearningReviewLoadResult
      setState((prev) => ({
        ...prev,
        load: result,
        verdicts: result.ok ? result.verdicts : prev.verdicts
      }))
      if (result.ok && result.candidates.length > 0) {
        setSelectedId((prev) => prev ?? result.candidates[0].id)
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : String(error)
      }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const onOpen = (): void => {
      setOpen(true)
      void load()
    }
    window.addEventListener(COOP_LEARNING_REVIEW_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(COOP_LEARNING_REVIEW_OPEN_EVENT, onOpen)
  }, [load])

  const close = useCallback((): void => {
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  const candidates = useMemo(() => state.load?.ok ? state.load.candidates : [], [state.load])
  const selected = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedId) ?? null,
    [candidates, selectedId]
  )
  const selectedReplay = selected ? state.replay[selected.id] : undefined

  const setVerdict = useCallback(
    async (candidate: LearningCandidate, verdict: LearningCandidateVerdict): Promise<void> => {
      setState((prev) => ({ ...prev, error: null }))
      try {
        const result = (await window.api.coopLearningReview.setVerdict({
          source: candidate.source,
          candidateId: candidate.id,
          verdict
        })) as { ok: boolean; verdicts: Record<string, LearningCandidateVerdict>; error?: string }
        if (!result.ok) {
          setState((prev) => ({ ...prev, error: result.error ?? 'Falha ao salvar veredito' }))
          return
        }
        setState((prev) => ({ ...prev, verdicts: result.verdicts }))
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : String(error)
        }))
      }
    },
    []
  )

  const replay = useCallback(async (candidate: LearningCandidate): Promise<void> => {
    if (!candidate.citation) {
      return
    }
    setState((prev) => ({ ...prev, replayingId: candidate.id, error: null }))
    try {
      const result = (await window.api.coopLearningReview.replay({
        citation: candidate.citation
      })) as ReplayCitationResult
      setState((prev) => ({
        ...prev,
        replayingId: null,
        replay: { ...prev.replay, [candidate.id]: result }
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        replayingId: null,
        error: error instanceof Error ? error.message : String(error)
      }))
    }
  }, [])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <Card className="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">Revisão de candidatos de aprendizado de corpus</CardTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Recarregar candidatos"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Fechar">
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
          {state.error ? (
            <div className="flex items-start gap-2 border-b p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          ) : null}
          {loading && !state.load ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando candidatos…
            </div>
          ) : !state.load?.ok ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
              {state.load?.error ?? 'Nenhuma fonte de candidatos encontrada.'}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              <div className="flex w-1/3 min-w-0 flex-col overflow-y-auto border-r">
                {candidates.map((candidate) => {
                  const verdict = state.verdicts[candidate.id] ?? 'pending'
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => setSelectedId(candidate.id)}
                      className={`flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left transition-colors ${
                        candidate.id === selectedId ? 'bg-accent' : 'hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium">
                          {candidate.taskId ?? candidate.source} · {candidate.origin}
                        </span>
                        <Badge className={`shrink-0 text-[10px] ${VERDICT_STYLE[verdict]}`}>
                          {VERDICT_LABEL[verdict]}
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{candidate.ruleText}</p>
                      <p className="truncate text-[10px] text-muted-foreground/70">
                        {citationSummary(candidate)}
                      </p>
                    </button>
                  )
                })}
              </div>
              <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
                {selected ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {selected.origin === 'extractor' ? 'Extrator (DEVX-023)' : 'Relatório (DEVX-025)'}
                      </Badge>
                      {selected.extra?.markerToken ? (
                        <Badge variant="outline" className="text-[10px]">
                          {String(selected.extra.markerToken)}
                        </Badge>
                      ) : null}
                      {selected.extra?.severity ? (
                        <Badge variant="outline" className="text-[10px]">
                          {String(selected.extra.severity)}
                        </Badge>
                      ) : null}
                    </div>
                    <h2 className="text-sm font-semibold">Regra proposta</h2>
                    <p className="whitespace-pre-wrap text-sm">{selected.ruleText}</p>
                    <h2 className="text-sm font-semibold">Citação</h2>
                    <div className="flex flex-col gap-1 rounded-md border bg-muted/40 p-3 font-mono text-xs">
                      <span>{citationSummary(selected)}</span>
                      {selected.citation?.section ? (
                        <span className="text-muted-foreground">{selected.citation.section}</span>
                      ) : null}
                      {selected.citation?.grep ? (
                        <span className="text-muted-foreground">grep: {selected.citation.grep}</span>
                      ) : null}
                    </div>
                    {selected.citation ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void replay(selected)}
                          disabled={state.replayingId === selected.id}
                        >
                          {state.replayingId === selected.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="size-3.5" />
                          )}
                          Reabrir citação
                        </Button>
                      </div>
                    ) : null}
                    {selectedReplay ? (
                      <div className="flex flex-col gap-1">
                        <h2 className="text-sm font-semibold">Contexto original</h2>
                        {selectedReplay.ok ? (
                          <>
                            <p className="text-xs text-muted-foreground">
                              {selectedReplay.file}
                              {selectedReplay.sectionHeading
                                ? ` · § ${selectedReplay.sectionHeading}`
                                : ''}
                              {selectedReplay.matchLine
                                ? ` · linha ${selectedReplay.matchLine}`
                                : ''}
                            </p>
                            <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                              {selectedReplay.contextLines.join('\n')}
                            </pre>
                          </>
                        ) : (
                          <p className="text-xs text-destructive">{selectedReplay.error}</p>
                        )}
                      </div>
                    ) : null}
                    <div className="flex gap-2 border-t pt-3">
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => void setVerdict(selected, 'accepted')}
                      >
                        <Check className="size-3.5" />
                        Aceitar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-destructive"
                        onClick={() => void setVerdict(selected, 'rejected')}
                      >
                        <XCircle className="size-3.5" />
                        Rejeitar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void setVerdict(selected, 'pending')}
                      >
                        Deixar pendente
                      </Button>
                      <span className="ml-auto self-center text-xs text-muted-foreground">
                        Veredito: {VERDICT_LABEL[state.verdicts[selected.id] ?? 'pending']}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Selecione um candidato na lista.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
