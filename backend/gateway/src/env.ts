import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'

const gatewayRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

config({
  path: [
    path.join(gatewayRoot, '.env.local'),
    path.join(gatewayRoot, '.env.development'),
    path.join(gatewayRoot, '.env'),
  ],
  quiet: true,
})
