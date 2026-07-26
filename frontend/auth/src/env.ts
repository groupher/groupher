import path from 'node:path'

import { config } from 'dotenv'

const cwd = process.cwd()
const authRoot = path.basename(cwd) === 'auth' ? cwd : path.join(cwd, 'frontend/auth')

config({
  path: [
    path.join(authRoot, '.env.local'),
    path.join(authRoot, '.env.development'),
    path.join(authRoot, '.env'),
  ],
  quiet: true,
})
