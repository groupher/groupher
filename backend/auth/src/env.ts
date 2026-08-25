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

// Wrangler can erase `import.meta.url` while bundling this shared module for a Worker.
// Worker bindings already provide the runtime environment, so dotenv is only needed by Node.
if (import.meta.url) {
  const authRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

  config({
    path: [
      path.join(authRoot, '.env.local'),
      path.join(authRoot, '.env.development'),
      path.join(authRoot, '.env'),
    ],
    quiet: true,
  })
}
