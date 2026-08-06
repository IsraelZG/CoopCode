import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const taskArg = args.find((arg) => !arg.startsWith('--'))
const dryRun = args.includes('--dry-run')
const agentArg = args.find((arg) => arg.startsWith('--agent='))
const worktreeRootArg = args.find((arg) => arg.startsWith('--worktree-root='))

// Known valid agent IDs from apps/desktop/orca/src/shared/tui-agent-config.ts
const VALID_AGENTS = new Set([
  'claude', 'claude-agent-teams', 'openclaude', 'codex', 'autohand', 'ante',
  'opencode', 'mimo-code', 'pi', 'omp', 'gemini', 'antigravity', 'aider',
  'goose', 'amp', 'kilo', 'kiro', 'crush', 'aug', 'cline', 'codebuff',
  'command-code', 'continue', 'copilot', 'cursor', 'devin', 'droid',
  'grok', 'hermes', 'kimi', 'mistral-vibe', 'openclaw', 'qwen-code', 'rovo'
])

const agent = agentArg ? agentArg.slice('--agent='.length) : 'crush'

if (!VALID_AGENTS.has(agent)) {
  console.error(`Invalid agent: "${agent}". Must be one of: ${[...VALID_AGENTS].sort().join(', ')}`)
  process.exit(2)
}

if (!taskArg) {
  console.error(
    'Usage: node tools/coop-dev/dispatch-task.mjs <task.md> [--agent=<name>] [--dry-run] [--worktree-root=<path>]',
  )
  process.exit(2)
}

function run(command, commandArgs, cwd = repoRoot, allowFailure = false) {
  const result = spawnSync(command, commandArgs, { cwd, encoding: 'utf8', shell: false })
  if (!allowFailure && result.status !== 0) {
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    process.exit(result.status ?? 1)
  }
  return result
}

// Step 1: Determine orca CLI command (ORCA_CLI_COMMAND env var or fallback to "coopcode")
const orcaCmd = process.env.ORCA_CLI_COMMAND || 'coopcode'

// Step 2: Check Orca is reachable
async function checkOrca() {
  const status = spawnSync(orcaCmd, ['status', '--json'], { cwd: repoRoot, encoding: 'utf8', shell: false, timeout: 15_000 })
  if (status.status === 0) return true

  console.error('Orca is not running.')
  console.error('Attempting to start Orca via "%s open --json"...', orcaCmd)
  const open = spawnSync(orcaCmd, ['open', '--json'], { cwd: repoRoot, encoding: 'utf8', shell: false, timeout: 30_000 })
  if (open.status !== 0) {
    console.error('Failed to start Orca automatically:')
    if (open.stderr) console.error(open.stderr.trim())
    if (open.stdout) console.error(open.stdout.trim())
    console.error('')
    console.error('Orca was not found on PATH and could not be started automatically.')
    console.error('Please start Orca manually and ensure "%s" is available on PATH,', orcaCmd)
    console.error('or set ORCA_CLI_COMMAND to the full path of the orca executable.')
    return false
  }

  // Brief pause for Orca to finish starting
  const { setTimeout } = await import('node:timers/promises')
  await setTimeout(2000)

  const retry = spawnSync(orcaCmd, ['status', '--json'], { cwd: repoRoot, encoding: 'utf8', shell: false, timeout: 30_000 })
  if (retry.status !== 0) {
    console.error('Orca started but is not yet responding.')
    console.error('Try running "%s status --json" manually to confirm it is ready, then retry dispatch.', orcaCmd)
    return false
  }
  return true
}

// Step 3: Run prepare-task.mjs to create the worktree and extract info
function prepareWorktree() {
  const prepareScript = path.join(repoRoot, 'tools', 'coop-dev', 'prepare-task.mjs')
  const prepareArgs = [prepareScript, taskArg]
  if (worktreeRootArg) prepareArgs.push(worktreeRootArg)
  if (dryRun) prepareArgs.push('--dry-run')

  const result = run(process.execPath, prepareArgs)
  const output = result.stdout

  const branchMatch = output.match(/^Branch: (.+)$/m)
  const worktreeMatch = output.match(/^Worktree: (.+)$/m)
  const baseMatch = output.match(/^Base: (.+)$/m)
  const promptMatch = output.match(/PROMPT:\s*\n\s*\n(.+)$/ms)

  if (!branchMatch || !worktreeMatch || !baseMatch || !promptMatch) {
    console.error('Failed to parse output from prepare-task.mjs:')
    console.error(output)
    process.exit(1)
  }

  return {
    branch: branchMatch[1],
    worktree: worktreeMatch[1],
    base: baseMatch[1],
    prompt: promptMatch[1].trim()
  }
}

async function dispatch() {
  const { branch, worktree, base, prompt } = prepareWorktree()

  // Step 4: Parse task frontmatter for title
  const taskPath = path.resolve(repoRoot, taskArg)
  const text = await readFile(taskPath, 'utf8')
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!frontmatter) {
    console.error('Task file has invalid frontmatter')
    process.exit(1)
  }
  const task = JSON.parse(frontmatter[1])
  const taskId = task.id
  const taskTitle = task.title
  const displayName = `${taskId}: ${taskTitle}`

  if (dryRun) {
    console.log(`DRY RUN: Would dispatch ${taskId}`)
    console.log(`  task-create: --spec ${taskArg} --task-title "${taskTitle}" --display-name "${displayName}"`)
    console.log(`  worker-start: --task ${taskId} --worktree ${worktree} --agent ${agent} --display-name "${displayName}" --repo ${repoRoot} --base-branch ${branch}`)
    console.log(`  comment: ${prompt}`)
    return
  }

  // Step 5: Verify orca connectivity
  const orcaReady = await checkOrca()
  if (!orcaReady) {
    console.error('')
    console.error('=== FALLBACK: Manual Dispatch ===')
    console.error('')
    console.error('Orca is not available for automatic dispatch. The worktree has been prepared.')
    console.error('To dispatch manually, paste the following into an Orca agent pane:')
    console.error('')
    console.error(prompt)
    console.error('')
    console.error('Then run these Orca CLI commands once connected:')
    console.error(`  ${orcaCmd} orchestration task-create --spec ${taskArg} --task-title "${taskTitle}" --display-name "${displayName}"`)
    console.error(`  ${orcaCmd} orchestration worker-start --task ${taskId} --worktree "${worktree}" --agent ${agent} --display-name "${displayName}" --repo "${repoRoot}" --base-branch ${branch} --comment "${prompt.replace(/"/g, '\\"')}"`)
    process.exit(1)
  }

  // Step 6: Create the orchestration task
  console.log('Creating orchestration task...')
  const createResult = run(orcaCmd, [
    'orchestration', 'task-create',
    '--spec', taskArg,
    '--task-title', taskTitle,
    '--display-name', displayName
  ])
  console.log(createResult.stdout.trim())

  // Step 7: Start the worker
  console.log('Starting worker...')
  const workerResult = run(orcaCmd, [
    'orchestration', 'worker-start',
    '--task', taskId,
    '--worktree', worktree,
    '--agent', agent,
    '--display-name', displayName,
    '--comment', prompt,
    '--repo', repoRoot,
    '--base-branch', branch
  ])
  console.log(workerResult.stdout.trim())
  console.log('')
  console.log('Dispatch complete.')
}

dispatch().catch((err) => {
  console.error('Dispatch failed:', err.message)
  process.exit(1)
})
