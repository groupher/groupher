import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Generator, getConfig } from '@tanstack/router-generator'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = getConfig(
  {
    generatedRouteTree: './src/routeTree.gen.ts',
    quoteStyle: 'single',
    routesDirectory: './src/routes',
    semicolons: false,
  },
  root,
)

await new Generator({ config, root }).run()
