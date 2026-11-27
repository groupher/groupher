import { createInterface } from 'node:readline'

import { openReadOnlyDatabase, readOnlyStatement } from './database-read-only.ts'

/** Read a verified local database through a temporary, restricted PostgreSQL identity. */
export async function runReadOnlyDatabaseCli(root: string, args: string[]): Promise<void> {
  let purpose: 'dev' | 'test' = 'dev'
  let sql: string | undefined
  let targetSeen = false
  let interactive = false
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    if (flag === '--target' && !targetSeen && ['dev', 'test'].includes(args[index + 1])) {
      purpose = args[++index] as 'dev' | 'test'
      targetSeen = true
    } else if (flag === '--sql' && sql === undefined && args[index + 1] !== undefined) {
      sql = args[++index]
    } else if (flag === '--interactive' && !interactive) {
      interactive = true
    } else {
      throw new Error(
        'Usage: pnpm devhub db inspect [--target dev|test] [--interactive | --sql <statement>]',
      )
    }
  }
  if (interactive && sql !== undefined) throw new Error('Choose --interactive or --sql, not both.')
  if (sql !== undefined) readOnlyStatement(sql)
  let interrupted = false
  let lines: ReturnType<typeof createInterface> | undefined
  const interrupt = (exitCode: number) => {
    interrupted = true
    process.exitCode = exitCode
    lines?.close()
  }
  const onInterrupt = () => interrupt(130)
  const onTerminate = () => interrupt(143)
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onTerminate)
  let session: Awaited<ReturnType<typeof openReadOnlyDatabase>> | undefined
  try {
    session = await openReadOnlyDatabase(root, purpose)
    if (interrupted) return
    if (sql !== undefined) {
      process.stdout.write(`${await session.query(sql)}\n`)
      return
    }
    lines = createInterface({
      input: process.stdin,
      output: process.stderr,
      terminal: process.stdin.isTTY,
    })
    lines.on('SIGINT', onInterrupt)
    process.stderr.write(
      `Read-only ${session.target.database} on ${session.target.hostname}:${session.target.port}. One statement per line; type quit to exit.\n`,
    )
    if (process.stdin.isTTY) {
      lines.setPrompt('read-only> ')
      lines.prompt()
    }
    for await (const line of lines) {
      if (['quit', 'exit', '\\q'].includes(line.trim().toLowerCase())) break
      if (!line.trim()) {
        if (process.stdin.isTTY) lines.prompt()
        continue
      }
      try {
        process.stdout.write(`${await session.query(line)}\n`)
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      }
      if (process.stdin.isTTY && !interrupted) lines.prompt()
    }
  } finally {
    lines?.close()
    try {
      await session?.close()
    } finally {
      process.off('SIGINT', onInterrupt)
      process.off('SIGTERM', onTerminate)
    }
  }
}
