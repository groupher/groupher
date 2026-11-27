import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { TDatabaseTarget } from './database-ownership.ts'

/** Use an explicit loopback connection without inheriting PostgreSQL overrides. */
export function localAdminQuery(
  target: TDatabaseTarget,
  environment: NodeJS.ProcessEnv,
  database = 'postgres',
) {
  if (database !== 'postgres' && database !== target.database)
    throw new Error('Database connection is outside the managed target.')
  if (Object.keys(environment).some((key) => key.startsWith('PG') && environment[key]))
    throw new Error('PostgreSQL environment overrides are not allowed for managed operations.')
  return async (sql: string) => {
    const { stdout } = await promisify(execFile)(
      'psql',
      [
        '-X',
        '-q',
        '-A',
        '-t',
        '-v',
        'ON_ERROR_STOP=1',
        '-h',
        target.hostname,
        '-p',
        String(target.port),
        '-U',
        environment.DB_USERNAME || 'postgres',
        '-d',
        database,
        '-c',
        sql,
      ],
      {
        env: { ...environment, PGPASSWORD: environment.DB_PASSWORD || 'postgres' },
        maxBuffer: 1024 * 1024,
      },
    )
    return stdout.trim()
  }
}
