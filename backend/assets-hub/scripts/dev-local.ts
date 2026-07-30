import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'

type TProcessSpec = {
  args: string[]
  command: string
  name: string
  port: number
}

const processes: TProcessSpec[] = [
  { args: ['dev:upload-api'], command: 'yarn', name: 'upload-api', port: 8002 },
  { args: ['dev:read-worker'], command: 'yarn', name: 'read-worker', port: 8787 },
]

const children = new Set<ChildProcess>()
let shuttingDown = false

const prefixChunk = (name: string, chunk: Buffer | string) => {
  const text = String(chunk)
  const lines = text.split(/(\r?\n)/)

  let output = ''
  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index]
    const newline = lines[index + 1] ?? ''
    if (!line && !newline) continue
    output += line ? `[${name}] ${line}${newline}` : newline
  }

  return output
}

const stopChild = (child: ChildProcess) => {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return

  try {
    if (process.platform === 'win32') child.kill('SIGTERM')
    else process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }
}

const shutdown = () => {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) stopChild(child)
}

const isPortListening = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    let settled = false

    const finish = (listening: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(listening)
    }

    socket.setTimeout(300)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

const occupiedPorts = (
  await Promise.all(
    processes.map(async (spec) => ({
      listening: await isPortListening(spec.port),
      spec,
    })),
  )
)
  .filter(({ listening }) => listening)
  .map(({ spec }) => `${spec.name}:${spec.port}`)

if (occupiedPorts.length > 0) {
  console.error(`Assets Hub local dev ports are already in use: ${occupiedPorts.join(', ')}`)
  process.exit(1)
}

for (const spec of processes) {
  const child = spawn(spec.command, spec.args, {
    cwd: process.cwd(),
    detached: process.platform !== 'win32',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  children.add(child)
  process.stdout.write(`[${spec.name}] $ ${[spec.command, ...spec.args].join(' ')}\n`)

  child.stdout?.on('data', (chunk) => process.stdout.write(prefixChunk(spec.name, chunk)))
  child.stderr?.on('data', (chunk) => process.stderr.write(prefixChunk(spec.name, chunk)))

  child.on('exit', (code, signal) => {
    children.delete(child)
    process.stdout.write(
      `[${spec.name}] exited with ${signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`}\n`,
    )

    if (!shuttingDown) {
      shutdown()
      process.exitCode = code || 1
    }
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
