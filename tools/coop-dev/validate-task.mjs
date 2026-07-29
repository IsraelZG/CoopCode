import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const taskPath = process.argv[2]
if (!taskPath) {
  console.error('Usage: node tools/coop-dev/validate-task.mjs <task.md>')
  process.exit(2)
}

const text = await readFile(taskPath, 'utf8')
const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
if (!match) {
  console.error(`${taskPath}: missing frontmatter`)
  process.exit(1)
}

let task
try {
  task = JSON.parse(match[1])
} catch (error) {
  console.error(`${taskPath}: frontmatter must be JSON-compatible YAML: ${error.message}`)
  process.exit(1)
}

const errors = []
const allowedStates = new Set(['draft', 'ready', 'working', 'review', 'done', 'blocked'])
const allowedLanes = new Set(['quick', 'standard', 'high-risk'])
const allowedRisks = new Set(['routine', 'high'])
const requiredStrings = ['id', 'title', 'state', 'lane', 'priority', 'risk']

for (const field of requiredStrings) {
  if (typeof task[field] !== 'string' || task[field].trim() === '') errors.push(`${field} is required`)
}
if (!allowedStates.has(task.state)) errors.push(`state must be one of: ${[...allowedStates].join(', ')}`)
if (!allowedLanes.has(task.lane)) errors.push(`lane must be one of: ${[...allowedLanes].join(', ')}`)
if (!allowedRisks.has(task.risk)) errors.push(`risk must be one of: ${[...allowedRisks].join(', ')}`)
for (const field of ['depends_on', 'blocked_on', 'capabilities', 'gates']) {
  if (!Array.isArray(task[field])) errors.push(`${field} must be an array`)
}
if (!Array.isArray(task?.scope?.allow) || task.scope.allow.length === 0) {
  errors.push('scope.allow must contain at least one path')
}
for (const field of ['wall_minutes', 'attempts', 'reworks']) {
  if (!Number.isInteger(task?.budget?.[field]) || task.budget[field] < (field === 'reworks' ? 0 : 1)) {
    errors.push(`budget.${field} must be a valid integer`)
  }
}
if (task.lane === 'high-risk' && task.risk !== 'high') errors.push('high-risk lane requires risk: high')
if (task.state === 'ready' && task.gates.length === 0) errors.push('ready task requires at least one gate')

const acceptance = text.match(/## Acceptance\r?\n([\s\S]*?)(?=\r?\n## |\s*$)/)?.[1] ?? ''
const criteria = [...acceptance.matchAll(/^- \[[ xX]\] .+/gm)]
if (criteria.length < 1 || criteria.length > 5) {
  errors.push('Acceptance must contain between 1 and 5 checkbox criteria')
}
for (const heading of ['## Outcome', '## Non-goals', '## Sources and decisions', '## Handoff']) {
  if (!text.includes(heading)) errors.push(`missing section: ${heading}`)
}

if (errors.length > 0) {
  console.error(`${path.normalize(taskPath)} is invalid:\n${errors.map((item) => `- ${item}`).join('\n')}`)
  process.exit(1)
}

console.log(`OK: ${task.id} (${task.state}, ${task.lane}, ${criteria.length} criteria)`)
