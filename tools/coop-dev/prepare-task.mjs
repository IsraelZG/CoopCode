import { spawnSync } from 'node:child_process'
import { access, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const taskArg = args.find((arg) => !arg.startsWith('--'))
const dryRun = args.includes('--dry-run')
const worktreeRootArg = args.find((arg) => arg.startsWith('--worktree-root='))

if (!taskArg) {
  console.error(
    'Usage: node tools/coop-dev/prepare-task.mjs <task.md> [--dry-run] [--worktree-root=<path>]',
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

async function exists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

const taskPath = path.resolve(repoRoot, taskArg)
const relativeTask = path.relative(repoRoot, taskPath)
if (relativeTask.startsWith('..') || path.isAbsolute(relativeTask)) {
  throw new Error('Task file must be inside the CoopCode repository')
}

run(process.execPath, ['tools/coop-dev/validate-task.mjs', relativeTask])

const text = await readFile(taskPath, 'utf8')
const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
const task = JSON.parse(frontmatter[1])
if (task.state !== 'ready') throw new Error(`Task ${task.id} is not ready`)

const status = run('git', ['status', '--porcelain']).stdout.trim()
if (status) throw new Error('Main checkout is dirty; commit or move those changes before dispatch')

const branch = `task/${task.id.toLowerCase()}`
const worktreeRoot =
  worktreeRootArg?.slice('--worktree-root='.length) ||
  process.env.COOP_WORKTREE_ROOT ||
  path.resolve(repoRoot, '..', 'worktrees', 'CoopCode')
const worktree = path.join(worktreeRoot, task.id)
const existingBranch = run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], repoRoot, true)
if (existingBranch.status === 0) throw new Error(`Branch already exists: ${branch}`)
if (await exists(worktree)) throw new Error(`Worktree path already exists: ${worktree}`)

if (!dryRun) {
  run('git', ['fetch', 'origin'])
  await mkdir(worktreeRoot, { recursive: true })
  run('git', ['worktree', 'add', worktree, '-b', branch, 'origin/main'])
  run(process.execPath, ['tools/coop-dev/install-skills.mjs'], worktree)
  run(process.execPath, ['tools/coop-dev/validate-task.mjs', relativeTask], worktree)
}

const base = run('git', ['rev-parse', dryRun ? 'HEAD' : 'origin/main']).stdout.trim()
const prompt = [
  `Trabalhe exclusivamente em ${worktree}.`,
  `Use $coop-worker para executar ${relativeTask.replaceAll('\\', '/')} a partir do base ${base}.`,
  'Leia os AGENTS.md aplicáveis, respeite scope e gates, faça commit local e retorne o handoff.',
  'Não faça push, merge nem remova a worktree.',
].join(' ')

console.log(`${dryRun ? 'DRY RUN' : 'READY'}: ${task.id}`)
console.log(`Branch: ${branch}`)
console.log(`Worktree: ${worktree}`)
console.log(`Base: ${base}`)
console.log('\nPROMPT:\n')
console.log(prompt)
