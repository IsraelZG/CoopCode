import { spawn } from 'node:child_process'
import { openSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const DEFAULT_LOG = resolve(repoRoot, 'logs', 'full-suite.log')
const DEFAULT_MARKER = resolve(repoRoot, 'logs', 'full-suite.marker')
const DEFAULT_CWD = resolve(repoRoot, 'apps', 'desktop', 'orca')

function parseArgs(argv) {
  const args = argv.slice(2)
  let logFile = DEFAULT_LOG
  let markerFile = DEFAULT_MARKER
  let cwd = DEFAULT_CWD
  let command = null
  let i = 0

  while (i < args.length) {
    if (args[i] === '--log' && i + 1 < args.length) {
      logFile = resolve(args[++i])
    } else if (args[i] === '--marker' && i + 1 < args.length) {
      markerFile = resolve(args[++i])
    } else if (args[i] === '--cwd' && i + 1 < args.length) {
      cwd = resolve(args[++i])
    } else if (args[i] === '--') {
      command = args.slice(i + 1)
      break
    } else {
      command = args.slice(i)
      break
    }
    i++
  }

  return { logFile, markerFile, cwd, command }
}

function runDetachedChild({ logFile, markerFile, cwd, command }) {
  const [cmd, ...cmdArgs] = command

  return new Promise((resolvePromise) => {
    const logFd = openSync(logFile, 'w')
    const child = spawn(cmd, cmdArgs, {
      cwd,
      stdio: ['ignore', logFd, logFd],
      detached: true
    })

    child.on('error', (err) => {
      writeFile(markerFile, JSON.stringify({
        status: 'completed',
        exitCode: 1,
        error: err.message,
        finishedAt: new Date().toISOString()
      }) + '\n').catch(() => {})
    })

    child.on('exit', (code, signal) => {
      writeFile(markerFile, JSON.stringify({
        status: 'completed',
        exitCode: code,
        signal: signal ?? null,
        finishedAt: new Date().toISOString()
      }) + '\n').catch(() => {})
    })

    resolvePromise(child.pid)
  })
}

async function main() {
  const { logFile, markerFile, cwd, command } = parseArgs(process.argv)

  if (!command || command.length === 0) {
    console.error('Usage: node run-full-suite-detached.mjs [--log <file>] [--marker <file>] [--cwd <dir>] -- <command...>')
    process.exit(1)
  }

  await mkdir(dirname(logFile), { recursive: true })
  await mkdir(dirname(markerFile), { recursive: true })

  await writeFile(markerFile, JSON.stringify({
    status: 'started',
    startedAt: new Date().toISOString(),
    command: command.join(' '),
    cwd
  }) + '\n')

  const childPid = await runDetachedChild({ logFile, markerFile, cwd, command })

  const result = {
    status: 'detached',
    pid: childPid,
    logFile,
    markerFile,
    command: command.join(' ')
  }

  console.log(JSON.stringify(result))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
