import { spawn } from 'node:child_process'

const command = process.env.E2E_SERVER_COMMAND

if (!command) {
  console.error('E2E_SERVER_COMMAND is required')
  process.exit(1)
}

const child = spawn(command, {
  detached: process.platform !== 'win32',
  env: process.env,
  shell: true,
  stdio: 'ignore',
})

let stopping = false
let forceTimer
let exitTimer

const killChild = (signal) => {
  if (!child.pid) return

  try {
    if (process.platform === 'win32') child.kill(signal)
    else process.kill(-child.pid, signal)
  } catch (error) {
    if (error?.code !== 'ESRCH') console.error(error)
  }
}

const finish = (code) => {
  clearTimeout(forceTimer)
  clearTimeout(exitTimer)
  process.exit(code)
}

const stop = (signal) => {
  if (stopping) return
  stopping = true

  killChild(signal)
  forceTimer = setTimeout(() => killChild('SIGKILL'), 2_000)
  exitTimer = setTimeout(() => finish(0), 2_500)
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

child.once('error', (error) => {
  console.error(error)
  finish(1)
})

child.once('exit', (code) => finish(stopping ? 0 : (code ?? 1)))
