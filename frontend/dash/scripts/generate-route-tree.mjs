import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Generator, getConfig } from '@tanstack/router-generator'

const dashRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = getConfig(
  {
    generatedRouteTree: './src/routeTree.gen.ts',
    quoteStyle: 'single',
    routesDirectory: './src/routes',
    semicolons: false,
  },
  dashRoot,
)

await new Generator({ config, root: dashRoot }).run()
