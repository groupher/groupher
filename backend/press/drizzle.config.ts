/**
 * Implements the Drizzle.config boundary inside Press.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Press module
 *     -> cache / Phoenix projection
 *     -> public response
 */

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
