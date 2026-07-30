import { readFile } from 'node:fs/promises'
import process from 'node:process'

const args = process.argv.slice(2)

const doneArg = args.indexOf('--done')
let doneIds = []
if (doneArg !== -1 && doneArg + 1 < args.length) {
  doneIds = args[doneArg + 1].split(',').map((s) => s.trim()).filter(Boolean)
  args.splice(doneArg, 2)
}

const capArg = args.indexOf('--capabilities')
let availableCaps = ['repository-read', 'repository-write']
if (capArg !== -1 && capArg + 1 < args.length) {
  availableCaps = args[capArg + 1].split(',').map((s) => s.trim()).filter(Boolean)
  args.splice(capArg, 2)
}

const taskPaths = args.filter((a) => !a.startsWith('--'))

if (taskPaths.length === 0) {
  console.log(JSON.stringify({
    selected: null,
    reason: 'no tasks provided',
    excluded: []
  }, null, 2))
  process.exit(0)
}

const doneSet = new Set(doneIds)
const capSet = new Set(availableCaps)

const excluded = []
const eligible = []

for (const taskPath of taskPaths) {
  let task
  try {
    const text = await readFile(taskPath, 'utf8')
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) {
      excluded.push({ id: taskPath, reason: 'invalid frontmatter: missing --- delimiters' })
      continue
    }
    task = JSON.parse(match[1])
  } catch (err) {
    excluded.push({ id: taskPath, reason: `invalid frontmatter: ${err.message}` })
    continue
  }

  const id = task.id || taskPath

  if (task.state !== 'ready') {
    excluded.push({ id, reason: `state is '${task.state}', not 'ready'` })
    continue
  }

  if (Array.isArray(task.blocked_on) && task.blocked_on.length > 0) {
    excluded.push({ id, reason: `blocked on: ${task.blocked_on.join(', ')}` })
    continue
  }

  if (Array.isArray(task.depends_on) && task.depends_on.length > 0) {
    const missing = task.depends_on.filter((dep) => !doneSet.has(dep))
    if (missing.length > 0) {
      excluded.push({ id, reason: `missing dependency: ${missing.join(', ')}` })
      continue
    }
  }

  if (Array.isArray(task.capabilities) && task.capabilities.length > 0) {
    const missing = task.capabilities.filter((cap) => !capSet.has(cap))
    if (missing.length > 0) {
      excluded.push({ id, reason: `missing capability: ${missing.join(', ')}` })
      continue
    }
  }

  const priorityNum = task.priority ? parseInt(task.priority.slice(1), 10) : 99
  eligible.push({ id, priorityNum })
}

if (eligible.length === 0) {
  console.log(JSON.stringify({
    selected: null,
    reason: 'no eligible task found',
    excluded: excluded.map((e) => ({ id: e.id, reason: e.reason }))
  }, null, 2))
  process.exit(0)
}

eligible.sort((a, b) => {
  if (a.priorityNum !== b.priorityNum) return a.priorityNum - b.priorityNum
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
})

const selected = eligible[0]

for (let i = 1; i < eligible.length; i++) {
  const task = eligible[i]
  excluded.push({
    id: task.id,
    reason: task.priorityNum === selected.priorityNum
      ? `same priority (P${task.priorityNum}) as selected task ${selected.id}, which has the smaller ID`
      : `lower priority (P${task.priorityNum}) than selected task`
  })
}

excluded.sort((a, b) => {
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
})

console.log(JSON.stringify({
  selected: selected.id,
  reason: `highest priority (P${selected.priorityNum}) with smallest ID`,
  excluded: excluded.map((e) => ({ id: e.id, reason: e.reason }))
}, null, 2))
