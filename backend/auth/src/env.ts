/**
 * Loads and validates runtime environment values for Auth.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Auth module
 *     -> OAuth provider / Phoenix Accounts
 *     -> Session cookies or service token
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'

const authRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

config({
  path: [
    path.join(authRoot, '.env.local'),
    path.join(authRoot, '.env.development'),
    path.join(authRoot, '.env'),
  ],
  quiet: true,
})
