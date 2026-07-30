import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const policyPath = process.argv[2]
if (!policyPath) {
  console.error('Usage: node tools/coop-dev/validate-budget-policy.mjs <policy.json>')
  process.exit(2)
}

const text = await readFile(policyPath, 'utf8')

let policy
try {
  policy = JSON.parse(text)
} catch (error) {
  console.error(`${policyPath}: invalid JSON: ${error.message}`)
  process.exit(1)
}

const errors = []

if (typeof policy.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(policy.version)) {
  errors.push('version must be a semantic version string (e.g., 1.0.0)')
}

const defaults = policy.defaults
if (!defaults || typeof defaults !== 'object') {
  errors.push('defaults must be an object with routine and high_risk')
} else {
  for (const profile of ['routine', 'high_risk']) {
    const p = defaults[profile]
    if (!p || typeof p !== 'object') {
      errors.push(`defaults.${profile} must be an object`)
      continue
    }
    for (const field of ['wall_minutes', 'attempts', 'reworks']) {
      const min = field === 'reworks' ? 0 : 1
      if (!Number.isInteger(p[field]) || p[field] < min) {
        errors.push(`defaults.${profile}.${field} must be an integer >= ${min}`)
      }
    }
  }
}

const overnight = policy.overnight
if (!overnight || typeof overnight !== 'object') {
  errors.push('overnight must be an object')
} else {
  const required = [
    'max_tasks', 'max_concurrent_workers', 'end_time_utc',
    'network', 'allowed_commands', 'allowed_write_destinations', 'preserve_evidence'
  ]
  for (const field of required) {
    if (!(field in overnight)) {
      errors.push(`overnight.${field} is required`)
    }
  }
  if (!Number.isInteger(overnight.max_tasks) || overnight.max_tasks < 1) {
    errors.push('overnight.max_tasks must be an integer >= 1')
  }
  if (!Number.isInteger(overnight.max_concurrent_workers) || overnight.max_concurrent_workers < 1) {
    errors.push('overnight.max_concurrent_workers must be an integer >= 1')
  }
  if (typeof overnight.end_time_utc !== 'string' || !/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(overnight.end_time_utc)) {
    errors.push('overnight.end_time_utc must be a valid HH:MM string (00:00–23:59)')
  }
  if (!['blocked', 'allowlisted'].includes(overnight.network)) {
    errors.push('overnight.network must be "blocked" or "allowlisted"')
  }
  if (!Array.isArray(overnight.allowed_commands) || overnight.allowed_commands.length < 1) {
    errors.push('overnight.allowed_commands must be a non-empty array of strings')
  } else {
    for (let i = 0; i < overnight.allowed_commands.length; i++) {
      if (typeof overnight.allowed_commands[i] !== 'string' || overnight.allowed_commands[i].trim() === '') {
        errors.push(`overnight.allowed_commands[${i}] must be a non-empty string`)
      }
    }
  }
  if (!Array.isArray(overnight.allowed_write_destinations) || overnight.allowed_write_destinations.length < 1) {
    errors.push('overnight.allowed_write_destinations must be a non-empty array of strings')
  } else {
    for (let i = 0; i < overnight.allowed_write_destinations.length; i++) {
      if (typeof overnight.allowed_write_destinations[i] !== 'string' || overnight.allowed_write_destinations[i].trim() === '') {
        errors.push(`overnight.allowed_write_destinations[${i}] must be a non-empty string`)
      }
    }
  }
  if (typeof overnight.preserve_evidence !== 'boolean') {
    errors.push('overnight.preserve_evidence must be a boolean')
  }
}

const prohibited = policy.prohibited_actions
if (!Array.isArray(prohibited)) {
  errors.push('prohibited_actions must be an array')
} else {
  const requiredProhibited = ['push', 'merge', 'deploy', 'payment', 'material_removal']
  for (const action of requiredProhibited) {
    if (!prohibited.includes(action)) {
      errors.push(`prohibited_actions must include "${action}"`)
    }
  }
  for (let i = 0; i < prohibited.length; i++) {
    if (typeof prohibited[i] !== 'string' || prohibited[i].trim() === '') {
      errors.push(`prohibited_actions[${i}] must be a non-empty string`)
    }
  }
}

const stopConditions = policy.stop_conditions
const requiredStops = [
  'new_approval_required',
  'secret_encountered',
  'scope_escape',
  'merge_conflict',
  'unknown_baseline',
  'destructive_migration',
  'repeated_failure',
  'budget_exhausted',
  'product_architecture_question'
]
if (!Array.isArray(stopConditions)) {
  errors.push('stop_conditions must be an array')
} else {
  for (const condition of requiredStops) {
    if (!stopConditions.includes(condition)) {
      errors.push(`stop_conditions must include "${condition}"`)
    }
  }
  for (let i = 0; i < stopConditions.length; i++) {
    if (typeof stopConditions[i] !== 'string' || stopConditions[i].trim() === '') {
      errors.push(`stop_conditions[${i}] must be a non-empty string`)
    }
  }
}

if (errors.length > 0) {
  console.error(`${path.normalize(policyPath)} is invalid:\n${errors.map((item) => `- ${item}`).join('\n')}`)
  process.exit(1)
}

console.log(`OK: budget policy v${policy.version} (${stopConditions.length} stop conditions, ${prohibited.length} prohibited actions)`)
