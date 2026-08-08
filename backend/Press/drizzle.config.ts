import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

import { databaseUrlFromEnv } from './src/db/client'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrlFromEnv() || '' },
  schemaFilter: ['analysis'],
})
