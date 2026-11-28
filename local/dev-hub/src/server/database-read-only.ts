import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import {
  assertManagedDatabaseEnvironment,
  validateDatabaseTarget,
  type TDatabaseTarget,
} from './database-ownership.ts'
import { inspectManagedDatabase } from './database-inspect.ts'
import { registryRoot } from './storage-paths.ts'

const ROLE = /^groupher_inspect_[a-f0-9]{24}$/
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`
const readerLock = (target: TDatabaseTarget) =>
  `SELECT pg_advisory_xact_lock(hashtextextended(${literal(`groupher-devhub-readers:${target.database}`)}, 0));`
const revokeReaderGrants = (role: string) => `
  FOR schema_name IN SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg\\_%' ESCAPE '\\' AND nspname <> 'information_schema' LOOP
    EXECUTE format('REVOKE SELECT ON ALL TABLES IN SCHEMA %I FROM %I', schema_name, ${literal(role)});
    EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM %I', schema_name, ${literal(role)});
  END LOOP;`

type TPsqlOptions = { username: string; password: string; sql: string; redact?: string[] }

/** Remove temporary and administrator passwords before reporting a database failure. */
export function redactDatabaseError(message: string, secrets: string[]): string {
  for (const secret of secrets) {
    if (secret) message = message.replaceAll(secret, '[redacted]')
  }
  return message
}

async function psql(target: TDatabaseTarget, options: TPsqlOptions, env: NodeJS.ProcessEnv) {
  if (Object.keys(env).some((key) => key.startsWith('PG') && env[key]))
    throw new Error('PostgreSQL environment overrides are not allowed for managed operations.')
  const child = spawn(
    'psql',
    [
      '-X',
      '-q',
      '-A',
      '-t',
      '-w',
      '-v',
      'ON_ERROR_STOP=1',
      '-h',
      target.hostname,
      '-p',
      String(target.port),
      '-U',
      options.username,
      '-d',
      target.database,
    ],
    { env: { ...env, PGPASSWORD: options.password }, stdio: ['pipe', 'pipe', 'pipe'] },
  )
  let stdout = ''
  let stderr = ''
  let exceeded = false
  let inputError: Error | undefined
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk
    if (stdout.length > 4_000_000) {
      exceeded = true
      child.kill()
    }
  })
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk
    if (stderr.length > 1_000_000) {
      exceeded = true
      child.kill()
    }
  })
  child.stdin.on('error', (error) => {
    inputError = error
  })
  child.stdin.end(options.sql)
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => {
      if (inputError) reject(inputError)
      else if (exceeded) reject(new Error('Database output is too large; narrow the query.'))
      else if (code === 0) resolve()
      else {
        const message = redactDatabaseError(stderr, [options.password, ...(options.redact || [])])
        reject(new Error(message.trim() || `psql exited ${code}`))
      }
    })
  })
  return stdout.trim()
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

/** Reclaim only identified inactive readers owned by this target. */
export async function cleanTargetReaders(
  target: TDatabaseTarget,
  env: NodeJS.ProcessEnv,
  allInactive = false,
  databaseExists = true,
) {
  validateDatabaseTarget(target)
  const connection = databaseExists ? target : { ...target, database: 'postgres' }
  const admin = { username: env.DB_USERNAME || 'postgres', password: env.DB_PASSWORD || 'postgres' }
  const output = await psql(
    connection,
    {
      ...admin,
      sql: `SELECT COALESCE(json_agg(json_build_object('name', r.rolname, 'comment', shobj_description(r.oid, 'pg_authid'))), '[]'::json)
FROM pg_roles r
WHERE r.rolname LIKE 'groupher\\_inspect\\_%' ESCAPE '\\'
  ${allInactive ? '' : 'AND r.rolvaliduntil < now()'};`,
    },
    env,
  )
  const roles = JSON.parse(output) as Array<{ name: string; comment: string | null }>
  if (!Array.isArray(roles)) throw new Error('Invalid temporary reader inventory.')
  for (const role of roles) {
    if (!ROLE.test(role.name) || typeof role.comment !== 'string') continue
    let marker: unknown
    try {
      marker = JSON.parse(role.comment)
    } catch {
      continue
    }
    if (!marker || typeof marker !== 'object') continue
    const record = marker as Record<string, unknown>
    if (
      record.namespace !== 'groupher-devhub-reader' ||
      record.worktreeId !== target.worktreeId ||
      record.database !== target.database
    )
      continue
    if (!Number.isSafeInteger(record.ownerPid) || (record.ownerPid as number) <= 0)
      throw new Error('Temporary reader ownership is incomplete; preserve the database for review.')
    if (processExists(record.ownerPid as number)) {
      if (allInactive) throw new Error('A read-only database session is still active.')
      continue
    }
    const name = quote(role.name)
    const check = literal(Buffer.from(role.comment, 'utf8').toString('hex'))
    await psql(
      connection,
      {
        ...admin,
        sql: `BEGIN;
${readerLock(target)}
DO $cleanup$ DECLARE schema_name text; BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = ${literal(role.name)} ${allInactive ? '' : 'AND r.rolvaliduntil < now()'} AND encode(convert_to(shobj_description(r.oid, 'pg_authid'), 'UTF8'), 'hex') = ${check} AND NOT EXISTS (SELECT 1 FROM pg_stat_activity a WHERE a.usename = r.rolname)) THEN
    ${databaseExists ? revokeReaderGrants(role.name) : ''}
    ${databaseExists ? `REVOKE CONNECT ON DATABASE ${quote(target.database)} FROM ${name};` : ''}
    DROP ROLE ${name};
  ELSE
    RAISE EXCEPTION 'Temporary reader is active or its ownership changed';
  END IF;
END $cleanup$;
COMMIT;`,
      },
      env,
    )
  }
}

/** Accept one read statement; psql commands and additional statements are never forwarded. */
export function readOnlyStatement(input: string): string {
  const statement = input.trim().replace(/;\s*$/, '').trim()
  if (!/^(select|with|show|explain|values)\b/i.test(statement) || /[;\\\0]/.test(statement))
    throw new Error('Enter one SELECT, WITH, SHOW, EXPLAIN or VALUES statement.')
  return statement
}

/** Create a short-lived, target-scoped reader whose credentials never appear in command arguments. */
export async function openReadOnlyDatabase(
  root: string,
  purpose: 'dev' | 'test',
  directory = registryRoot(),
  env: NodeJS.ProcessEnv = process.env,
) {
  assertManagedDatabaseEnvironment(env)
  if (Object.keys(env).some((key) => key.startsWith('PG') && env[key]))
    throw new Error('PostgreSQL environment overrides are not allowed for managed operations.')
  const lock = path.join(root, 'local/dev-hub/config/database-create.lock')
  const deadline = Date.now() + 10_000
  while (true) {
    try {
      await mkdir(lock, { mode: 0o700 })
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || Date.now() >= deadline)
        throw new Error('Database operation is locked; inspect the owner before recovery.')
      await delay(100)
    }
  }
  try {
    await writeFile(
      path.join(lock, 'owner.json'),
      JSON.stringify({ operation: 'read-only-setup', pid: process.pid, purpose }),
      { flag: 'wx', mode: 0o600 },
    )
    const { target } = await inspectManagedDatabase(root, purpose, directory, env)
    const role = `groupher_inspect_${randomBytes(12).toString('hex')}`
    if (!ROLE.test(role)) throw new Error('Invalid temporary reader identity.')
    const password = randomBytes(32).toString('hex')
    const admin = {
      username: env.DB_USERNAME || 'postgres',
      password: env.DB_PASSWORD || 'postgres',
    }
    await cleanTargetReaders(target, env)
    const roleName = quote(role)
    const marker = JSON.stringify({
      namespace: 'groupher-devhub-reader',
      worktreeId: target.worktreeId,
      database: target.database,
      ownerPid: process.pid,
    })
    const setup = `BEGIN;
${readerLock(target)}
CREATE ROLE ${roleName} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${literal(password)} VALID UNTIL ${literal(new Date(Date.now() + 3_600_000).toISOString())};
COMMENT ON ROLE ${roleName} IS ${literal(marker)};
GRANT CONNECT ON DATABASE ${quote(target.database)} TO ${roleName};
DO $grant$ DECLARE name text; BEGIN
  FOR name IN SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg\\_%' ESCAPE '\\' AND nspname <> 'information_schema' LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', name, ${literal(role)});
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO %I', name, ${literal(role)});
  END LOOP;
END $grant$;
COMMIT;`
    await psql(target, { ...admin, sql: setup, redact: [password] }, env)
    let closed = false
    return {
      target,
      async query(input: string) {
        if (closed) throw new Error('The read-only session is closed.')
        const statement = readOnlyStatement(input)
        const verified = await inspectManagedDatabase(root, purpose, directory, env)
        if (
          verified.target.database !== target.database ||
          verified.target.worktreeId !== target.worktreeId
        )
          throw new Error('The managed database target changed during inspection.')
        return psql(
          target,
          {
            username: role,
            password,
            sql: `BEGIN READ ONLY;\nSET LOCAL statement_timeout = '15s';\n${statement};\nROLLBACK;\n`,
          },
          env,
        )
      },
      async close() {
        if (closed) return
        await psql(
          target,
          {
            ...admin,
            sql: `BEGIN; ${readerLock(target)} DO $revoke$ DECLARE schema_name text; BEGIN ${revokeReaderGrants(role)} END $revoke$; REVOKE CONNECT ON DATABASE ${quote(target.database)} FROM ${roleName}; DROP ROLE ${roleName}; COMMIT;`,
          },
          env,
        )
        closed = true
      },
    }
  } finally {
    await rm(lock, { recursive: true, force: true })
  }
}
