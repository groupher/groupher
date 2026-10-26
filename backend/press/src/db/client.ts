/**
 * Implements the Src Db Client boundary inside Press.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Press module
 *     -> cache / Phoenix projection
 *     -> public response
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Client } from 'pg'

import * as schema from './schema'

export type PressDatabase = NodePgDatabase<typeof schema> & { $client: Client }

/** Runs the database url from env operation at the press boundary. */
export const databaseUrlFromEnv = (
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined => {
  if (environment.DATABASE_URL) return environment.DATABASE_URL
  if (!environment.DB_HOST || !environment.DB_USERNAME || !environment.DB_NAME) return undefined

  const url = new URL('postgresql://localhost')
  url.hostname = environment.DB_HOST
  url.port = environment.DB_PORT || '5432'
  url.username = environment.DB_USERNAME
  url.password = environment.DB_PASSWORD || ''
  url.pathname = `/${environment.DB_NAME}`
  return url.toString()
}

/** Creates database from typed press inputs. */
export const createDatabase = (client: Client): PressDatabase => drizzle({ client, schema })
