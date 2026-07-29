import { cp, mkdir, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const sourceRoot = path.join(repoRoot, 'skills')
const targetRoots = [
  path.join(repoRoot, '.agents', 'skills'),
  path.join(repoRoot, '.claude', 'skills'),
]
const checkOnly = process.argv.includes('--check')

const entries = await readdir(sourceRoot, { withFileTypes: true })
const skills = entries
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('coop-'))
  .map((entry) => entry.name)
  .sort()

if (skills.length === 0) throw new Error('No canonical coop-* skills found')

async function filesUnder(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const next = path.join(relative, entry.name)
    if (entry.isDirectory()) files.push(...(await filesUnder(root, next)))
    else files.push(next)
  }
  return files
}

const drift = []
for (const targetRoot of targetRoots) {
  if (!checkOnly) await mkdir(targetRoot, { recursive: true })
  for (const skill of skills) {
    const source = path.join(sourceRoot, skill)
    const target = path.join(targetRoot, skill)
    if (!checkOnly) {
      await cp(source, target, { recursive: true, force: true })
      continue
    }
    for (const relative of await filesUnder(source)) {
      try {
        const [expected, actual] = await Promise.all([
          readFile(path.join(source, relative)),
          readFile(path.join(target, relative)),
        ])
        if (!expected.equals(actual)) drift.push(path.relative(repoRoot, path.join(target, relative)))
      } catch {
        drift.push(path.relative(repoRoot, path.join(target, relative)))
      }
    }
  }
}

if (drift.length > 0) {
  console.error(`Skill mirrors are stale:\n${drift.map((item) => `- ${item}`).join('\n')}`)
  process.exitCode = 1
} else {
  console.log(
    checkOnly
      ? `OK: ${skills.length} skills match both agent directories`
      : `Installed ${skills.length} skills into .agents/skills and .claude/skills`,
  )
}
