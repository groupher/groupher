import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export type PressDatabase = ReturnType<typeof drizzle>

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

export const createDatabase = (url = databaseUrlFromEnv()): PressDatabase | null => {
  if (!url) return null
  const client = postgres(url, { max: 4, idle_timeout: 20 })
  return drizzle(client)
}
