import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Generator, getConfig } from '@tanstack/router-generator'

const communityRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = getConfig(
  {
    generatedRouteTree: './src/routeTree.gen.ts',
    quoteStyle: 'single',
    routesDirectory: './src/routes',
    semicolons: false,
  },
  communityRoot,
)

await new Generator({ config, root: communityRoot }).run()
