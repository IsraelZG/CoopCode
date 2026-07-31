import type { Worker } from 'node:worker_threads'
import type { AiVaultScanIssue, AiVaultSession } from '../../shared/ai-vault-types'
import type {
  CrushSqliteListRequest,
  CrushSqliteListValue,
  CrushSqliteParseRequest,
  CrushSqliteWorkerRequest,
  CrushSqliteWorkerResponse
} from './session-scanner-crush-worker-protocol'
import type { SessionFileCandidate } from './session-scanner-types'
import { errorMessage } from './session-scanner-values'

export const LIST_TIMEOUT_MS = 30_000
export const PARSE_TIMEOUT_MS = 15_000
export const IDLE_TEARDOWN_MS = 30_000
export const MAX_CONSECUTIVE_DEATHS = 3

export type WorkerFactory = () => Worker

type CrushSqliteRequestBody =
  | Omit<CrushSqliteListRequest, 'id'>
  | Omit<CrushSqliteParseRequest, 'id'>

type PendingCall = {
  request: CrushSqliteWorkerRequest
  timeoutMs: number
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout | null
}

class CrushSqliteWorkerUnavailableError extends Error {}

export class CrushSqliteWorkerClient {
  private worker: Worker | null = null
  private active: PendingCall | null = null
  private queue: PendingCall[] = []
  private idleTimer: NodeJS.Timeout | null = null
  private consecutiveDeaths = 0
  private nextId = 1
  private loggedWorkerUnavailable = false
  private cleanupWorkerListeners: (() => void) | null = null
  private readonly workerFactory: WorkerFactory
  private readonly log: (message: string) => void

  constructor(options: { workerFactory: WorkerFactory; log?: (message: string) => void }) {
    this.workerFactory = options.workerFactory
    this.log = options.log ?? ((message) => console.warn(message))
  }

  async list(args: {
    dbPaths: readonly string[]
    limit: number
    issues: AiVaultScanIssue[]
  }): Promise<SessionFileCandidate[]> {
    if (args.dbPaths.length === 0) {
      return []
    }
    try {
      const value = (await this.dispatch(
        { kind: 'list', dbPaths: args.dbPaths, limit: args.limit },
        LIST_TIMEOUT_MS
      )) as CrushSqliteListValue
      args.issues.push(...value.issues)
      return value.candidates
    } catch (err) {
      if (err instanceof CrushSqliteWorkerUnavailableError) {
        args.issues.push({
          agent: 'crush',
          path: args.dbPaths[0] ?? 'crush.db',
          message:
            'Crush history was skipped because its background scanner could not start; the app remains responsive.'
        })
        return []
      }
      args.issues.push({
        agent: 'crush',
        path: args.dbPaths[0] ?? 'crush.db',
        message: `Crush history scan did not complete: ${errorMessage(err)}`
      })
      return []
    }
  }

  async parse(args: {
    dbPath: string
    sessionId: string
    platform: NodeJS.Platform
  }): Promise<AiVaultSession | null> {
    try {
      const value = await this.dispatch(
        { kind: 'parse', dbPath: args.dbPath, sessionId: args.sessionId, platform: args.platform },
        PARSE_TIMEOUT_MS
      )
      return value as AiVaultSession | null
    } catch (err) {
      if (err instanceof CrushSqliteWorkerUnavailableError) {
        throw new Error('Crush SQLite background scanner could not start.')
      }
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  private dispatch(request: CrushSqliteRequestBody, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      if (!this.active && this.queue.length === 0) {
        this.consecutiveDeaths = 0
      }
      this.queue.push({
        request: { ...request, id } as CrushSqliteWorkerRequest,
        timeoutMs,
        resolve,
        reject,
        timer: null
      })
      this.pump()
    })
  }

  private pump(): void {
    if (this.active || this.queue.length === 0) {
      return
    }
    const worker = this.ensureWorker()
    if (!worker) {
      this.failQueuedAsUnavailable()
      return
    }
    const call = this.queue.shift()
    if (!call) {
      return
    }
    this.active = call
    this.clearIdleTimer()
    call.timer = setTimeout(() => this.onTimeout(call), call.timeoutMs)
    call.timer.unref?.()
    worker.postMessage(call.request)
  }

  private ensureWorker(): Worker | null {
    if (this.worker) {
      return this.worker
    }
    try {
      const worker = this.workerFactory()
      const onMessage = (response: CrushSqliteWorkerResponse): void => this.onMessage(response)
      const onError = (error: Error): void => this.onWorkerFault(error)
      const onExit = (code: number): void => this.onWorkerExit(code)
      worker.on('message', onMessage)
      worker.on('error', onError)
      worker.on('exit', onExit)
      this.cleanupWorkerListeners = () => {
        worker.off('message', onMessage)
        worker.off('error', onError)
        worker.off('exit', onExit)
      }
      worker.unref()
      this.worker = worker
      this.loggedWorkerUnavailable = false
      return worker
    } catch (err) {
      if (!this.loggedWorkerUnavailable) {
        this.loggedWorkerUnavailable = true
        this.log(`Crush SQLite worker could not start: ${errorMessage(err)}`)
      }
      return null
    }
  }

  private onMessage(response: CrushSqliteWorkerResponse): void {
    const call = this.active
    if (!call || call.request.id !== response.id) {
      return
    }
    this.consecutiveDeaths = 0
    this.active = null
    this.clearTimeout(call)
    if (response.ok) {
      call.resolve(response.value)
    } else {
      call.reject(new Error(response.error))
    }
    this.scheduleIdleTeardown()
    this.pump()
  }

  private onWorkerFault(error: Error): void {
    this.consecutiveDeaths++
    const call = this.active
    this.active = null
    this.destroyWorker()
    if (call) {
      this.clearTimeout(call)
      call.reject(new Error(`Crush SQLite worker error: ${errorMessage(error)}`))
    }
    if (this.consecutiveDeaths >= MAX_CONSECUTIVE_DEATHS) {
      this.failQueued(new Error('Crush SQLite worker died repeatedly; scan aborted.'))
    } else {
      this.pump()
    }
  }

  private onWorkerExit(code: number): void {
    this.consecutiveDeaths++
    const call = this.active
    this.active = null
    this.destroyWorker()
    if (call) {
      this.clearTimeout(call)
      call.reject(new Error(`Crush SQLite worker exited with code ${code}`))
    }
    if (this.consecutiveDeaths >= MAX_CONSECUTIVE_DEATHS) {
      this.failQueued(new Error('Crush SQLite worker died repeatedly; scan aborted.'))
    } else {
      this.pump()
    }
  }

  private onTimeout(call: PendingCall): void {
    if (this.active !== call) {
      return
    }
    this.consecutiveDeaths++
    this.active = null
    call.timer = null
    this.destroyWorker()
    call.reject(new Error('Crush SQLite worker timed out.'))
    if (this.consecutiveDeaths >= MAX_CONSECUTIVE_DEATHS) {
      this.failQueued(new Error('Crush SQLite worker died repeatedly; scan aborted.'))
    } else {
      this.pump()
    }
  }

  private destroyWorker(): void {
    if (this.cleanupWorkerListeners) {
      this.cleanupWorkerListeners()
      this.cleanupWorkerListeners = null
    }
    if (this.worker) {
      this.worker.removeAllListeners()
      void this.worker.terminate().catch(() => {})
      this.worker = null
    }
  }

  private failQueuedAsUnavailable(): void {
    const err = new CrushSqliteWorkerUnavailableError('Crush SQLite worker unavailable.')
    this.failQueued(err)
  }

  private failQueued(error: Error): void {
    const call = this.active
    this.active = null
    if (call) {
      this.clearTimeout(call)
      call.reject(error)
    }
    let queued = this.queue.shift()
    while (queued) {
      this.clearTimeout(queued)
      queued.reject(error)
      queued = this.queue.shift()
    }
  }

  private clearTimeout(call: PendingCall): void {
    if (call.timer) {
      clearTimeout(call.timer)
      call.timer = null
    }
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  private scheduleIdleTeardown(): void {
    this.clearIdleTimer()
    if (this.active || this.queue.length > 0) {
      return
    }
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null
      if (!this.active && this.queue.length === 0) {
        this.destroyWorker()
      }
    }, IDLE_TEARDOWN_MS)
    this.idleTimer.unref?.()
  }
}
