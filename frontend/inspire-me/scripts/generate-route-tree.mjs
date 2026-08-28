import path from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { Generator, getConfig } from '@tanstack/router-generator'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = getConfig(
  {
    generatedRouteTree: './src/routeTree.gen.ts',
    quoteStyle: 'single',
    routesDirectory: './src/routes',
    semicolons: false,
  },
  appRoot,
)

await new Generator({ config, root: appRoot }).run()

const routeTreePath = path.join(appRoot, 'src/routeTree.gen.ts')
const routeTree = await readFile(routeTreePath, 'utf8')
const startRegister = `
import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
`

if (!routeTree.includes("declare module '@tanstack/react-start'")) {
  await writeFile(routeTreePath, `${routeTree.trimEnd()}\n${startRegister}`)
}
