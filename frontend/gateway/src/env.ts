import path from 'node:path'

import { config } from 'dotenv'

const cwd = process.cwd()
const gatewayRoot = path.basename(cwd) === 'gateway' ? cwd : path.join(cwd, 'frontend/gateway')

config({
  path: [
    path.join(gatewayRoot, '.env.local'),
    path.join(gatewayRoot, '.env.development'),
    path.join(gatewayRoot, '.env'),
  ],
  quiet: true,
})
