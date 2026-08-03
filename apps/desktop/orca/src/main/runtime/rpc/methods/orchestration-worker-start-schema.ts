import { z } from 'zod'
import { OptionalFiniteNumber, OptionalString, requiredString } from '../schemas'

export const WorkerStartParams = z.object({
  task: requiredString('Missing --task'),
  on: OptionalString,
  run: OptionalString,
  from: requiredString('Missing --from'),
  worktree: OptionalString,
  name: OptionalString,
  repo: OptionalString,
  baseBranch: OptionalString,
  displayName: OptionalString,
  comment: OptionalString,
  setup: z.enum(['run', 'skip', 'inherit']).optional(),
  terminal: OptionalString,
  agent: OptionalString,
  // Why: DEVX-044 — request a restricted opencode agent profile (built via
  // `opencode agent create --mode subagent --permissions <csv>`) for headless
  // `opencode run --attach --agent <profile>` dispatches. Valid for opencode only.
  opencodeAgentProfile: OptionalString,
  opencodeAgentPermissions: OptionalString,
  retryOf: OptionalString,
  timeoutMs: OptionalFiniteNumber,
  devMode: z.boolean().optional()
})

export type WorkerStartInput = z.infer<typeof WorkerStartParams>
