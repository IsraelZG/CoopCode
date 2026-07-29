import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const positional = args.filter((arg) => !arg.startsWith('--'))
const [taskArg, worktreeArg] = positional
const baseRef =
  args.find((arg) => arg.startsWith('--base-ref='))?.slice('--base-ref='.length) || 'origin/main'

if (!taskArg || !worktreeArg) {
  console.error(
    'Usage: node tools/coop-dev/prepare-review.mjs <task.md> <worktree> [--base-ref=<ref>]',
  )
  process.exit(2)
}

function run(command, commandArgs, cwd = repoRoot) {
  const result = spawnSync(command, commandArgs, { cwd, encoding: 'utf8', shell: false })
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    process.exit(result.status ?? 1)
  }
  return result.stdout.trim()
}

const taskPath = path.resolve(repoRoot, taskArg)
const relativeTask = path.relative(repoRoot, taskPath)
if (relativeTask.startsWith('..') || path.isAbsolute(relativeTask)) {
  throw new Error('Task file must be inside the CoopCode repository')
}

const worktree = path.resolve(worktreeArg)
const gitArgs = (...commandArgs) => ['-c', `safe.directory=${worktree}`, '-C', worktree, ...commandArgs]
run(process.execPath, ['tools/coop-dev/validate-task.mjs', relativeTask])
const taskText = await readFile(taskPath, 'utf8')
const task = JSON.parse(taskText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)[1])

if (run('git', gitArgs('status', '--porcelain'))) {
  throw new Error(`Worktree is dirty: ${worktree}`)
}

const result = run('git', gitArgs('rev-parse', 'HEAD'))
const base = run('git', gitArgs('merge-base', baseRef, result))
if (base === result) throw new Error(`No result commit found after ${baseRef}`)

const prompt = [
  `Use $coop-reviewer para revisar ${task.id} em modo somente leitura.`,
  `Worktree: ${worktree}. Task: ${relativeTask.replaceAll('\\', '/')}.`,
  `Base: ${base}. Resultado: ${result}.`,
  'Retorne accept, rework ou human com evidências; não edite, faça commit, push, merge ou rebase.',
].join(' ')

console.log(`READY FOR REVIEW: ${task.id}`)
console.log(`Worktree: ${worktree}`)
console.log(`Base: ${base}`)
console.log(`Result: ${result}`)
console.log('\nPROMPT:\n')
console.log(prompt)
