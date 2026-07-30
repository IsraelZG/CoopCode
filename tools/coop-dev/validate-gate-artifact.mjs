import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const positional = args.filter((arg) => !arg.startsWith('--'))
const artifactPath = positional[0]
const resultShaArg = args.find((arg) => arg.startsWith('--result-sha='))

if (!artifactPath) {
  console.error('Usage: node tools/coop-dev/validate-gate-artifact.mjs <artifact.json> [--result-sha=<sha>]')
  process.exit(2)
}

const schemaPath = path.resolve(repoRoot, 'docs', 'coop', 'schemas', 'gate-artifact-v1.schema.json')
const schema = JSON.parse(await readFile(schemaPath, 'utf8'))

const artifactFull = path.resolve(artifactPath)
let artifact
try {
  artifact = JSON.parse(await readFile(artifactFull, 'utf8'))
} catch (err) {
  console.error(`Invalid JSON: ${err.message}`)
  process.exit(1)
}

const errors = []

function fail(msg) {
  errors.push(msg)
}

function validateSchema(obj, schemaDef, pointer) {
  if (schemaDef.type && typeof obj !== schemaDef.type) {
    if (schemaDef.type === 'array' && !Array.isArray(obj)) {
      fail(`${pointer}: expected ${schemaDef.type}, got ${typeof obj}`)
      return
    }
    if (schemaDef.type !== 'array') {
      fail(`${pointer}: expected ${schemaDef.type}, got ${typeof obj}`)
      return
    }
  }

  if (schemaDef.required) {
    for (const key of schemaDef.required) {
      if (!(key in obj)) {
        fail(`${pointer}: missing required field "${key}"`)
      }
    }
  }

  if (schemaDef.properties && typeof obj === 'object' && obj !== null) {
    for (const [key, propSchema] of Object.entries(schemaDef.properties)) {
      if (key in obj) {
        const val = obj[key]
        const childPointer = pointer ? `${pointer}.${key}` : key

        if (propSchema.type === 'string') {
          if (typeof val !== 'string') {
            fail(`${childPointer}: expected string, got ${typeof val}`)
          } else if (propSchema.pattern) {
            const re = new RegExp(`^${propSchema.pattern}$`)
            if (!re.test(val)) {
              fail(`${childPointer}: "${val}" does not match pattern ${propSchema.pattern}`)
            }
          }
        } else if (propSchema.type === 'integer') {
          if (typeof val !== 'number' || !Number.isInteger(val)) {
            fail(`${childPointer}: expected integer, got ${typeof val}`)
          } else if (propSchema.minimum !== undefined && val < propSchema.minimum) {
            fail(`${childPointer}: ${val} is less than minimum ${propSchema.minimum}`)
          }
        } else if (propSchema.type === 'boolean') {
          if (typeof val !== 'boolean') {
            fail(`${childPointer}: expected boolean, got ${typeof val}`)
          }
        } else if (propSchema.type === 'array') {
          if (!Array.isArray(val)) {
            fail(`${childPointer}: expected array, got ${typeof val}`)
          } else {
            if (propSchema.minItems !== undefined && val.length < propSchema.minItems) {
              fail(`${childPointer}: expected at least ${propSchema.minItems} items, got ${val.length}`)
            }
            if (propSchema.items && propSchema.items.$ref) {
              const refName = propSchema.items.$ref.replace('#/definitions/', '')
              const refSchema = schemaDef.definitions?.[refName]
              if (refSchema) {
                val.forEach((item, i) => {
                  validateSchema(item, refSchema, `${childPointer}[${i}]`)
                })
              }
            }
          }
        } else if (propSchema.$ref) {
          const refName = propSchema.$ref.replace('#/definitions/', '')
          const refSchema = schemaDef.definitions?.[refName]
          if (refSchema) {
            validateSchema(val, refSchema, childPointer)
          }
        }
      }
    }
  }

  if (schemaDef.additionalProperties === false && typeof obj === 'object' && obj !== null) {
    const allowed = new Set(Object.keys(schemaDef.properties || {}))
    for (const key of Object.keys(obj)) {
      if (!allowed.has(key)) {
        fail(`${pointer}: unknown property "${key}"`)
      }
    }
  }
}

function validateArtifact(data) {
  validateSchema(data, schema, '')

  for (let i = 0; i < (data.gates || []).length; i++) {
    const gate = data.gates[i]
    if (gate.criteria) {
      for (let j = 0; j < gate.criteria.length; j++) {
        const crit = gate.criteria[j]
        if (!crit.description) {
          fail(`gates[${i}].criteria[${j}]: missing required field "description"`)
        }
        if (typeof crit.passed !== 'boolean') {
          fail(`gates[${i}].criteria[${j}]: missing required field "passed"`)
        }
      }
    }
  }

  if (data.logs) {
    for (let i = 0; i < data.logs.length; i++) {
      const log = data.logs[i]
      if (path.isAbsolute(log.path)) {
        fail(`logs[${i}].path: must be relative, got absolute path "${log.path}"`)
      }
    }
  }

  if (data.artifacts) {
    for (let i = 0; i < data.artifacts.length; i++) {
      const art = data.artifacts[i]
      if (path.isAbsolute(art.path)) {
        fail(`artifacts[${i}].path: must be relative, got absolute path "${art.path}"`)
      }
    }
  }

  if (resultShaArg) {
    const expectedSha = resultShaArg.slice('--result-sha='.length)
    if (data.resultSha !== expectedSha) {
      fail(`resultSha: expected "${expectedSha}", got "${data.resultSha}"`)
    }
  }
}

validateArtifact(artifact)

if (errors.length > 0) {
  for (const err of errors) {
    console.error(`FAIL: ${err}`)
  }
  process.exit(1)
}

console.log('VALID')
