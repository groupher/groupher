import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const communityRoot = path.join(repoRoot, 'frontend/community')
const routeTree = readFileSync(path.join(communityRoot, 'src/routeTree.gen.ts'), 'utf8')
const packageJson = JSON.parse(readFileSync(path.join(communityRoot, 'package.json'), 'utf8'))

const requiredPaths = [
  '/$community/about',
  '/$community/post',
  '/$community/post/$id',
  '/$community/post/previewer/$id',
  '/$community/changelog',
  '/$community/changelog/$id',
  '/$community/changelog/previewer/$id',
  '/$community/kanban',
  '/$community/kanban/previewer/post/$id',
  '/$community/doc',
  '/$community/doc/$id/$slug',
  '/$community/$',
  '/health',
  '/api/graphql',
  '/api/utils/slugify',
  '/internal/cache/revalidate',
]

const missing = requiredPaths.filter((route) => !routeTree.includes(`fullPath: '${route}'`))
if (missing.length > 0) throw new Error(`Missing generated Community routes: ${missing.join(', ')}`)

const routeFiles = [
  'src/routes/$community/route.tsx',
  'src/routes/$community/post/_layout/route.tsx',
  'src/routes/$community/changelog/_layout/route.tsx',
  'src/routes/$community/kanban/_layout/route.tsx',
  'src/routes/$community/post/_layout/index.tsx',
  'src/routes/$community/changelog/_layout/index.tsx',
  'src/routes/$community/kanban/_layout/index.tsx',
  'src/routes/$community/post/_layout/previewer/$id.tsx',
  'src/routes/$community/changelog/_layout/previewer/$id.tsx',
  'src/routes/$community/kanban/_layout/previewer/post/$id.tsx',
]
for (const relative of routeFiles) {
  const source = readFileSync(path.join(communityRoot, relative), 'utf8')
  if (source.includes('setQueryData')) throw new Error(`${relative} still uses setQueryData`)
}

for (const relative of [
  'src/routes/$community/post/_layout/index.tsx',
  'src/routes/$community/changelog/_layout/index.tsx',
  'src/routes/$community/kanban/_layout/index.tsx',
]) {
  const source = readFileSync(path.join(communityRoot, relative), 'utf8')
  if (source.includes('loader:') || !source.includes('component: () => null')) {
    throw new Error(`${relative} must remain an exact empty leaf`)
  }
}

for (const relative of [
  'src/routes/$community/post/_layout/previewer/$id.tsx',
  'src/routes/$community/changelog/_layout/previewer/$id.tsx',
  'src/routes/$community/kanban/_layout/previewer/post/$id.tsx',
]) {
  const source = readFileSync(path.join(communityRoot, relative), 'utf8')
  if (source.includes('head:')) throw new Error(`${relative} must not emit article head metadata`)
  if (!source.includes('beforeLoad:') || !source.includes('requireCanonicalPreviewMask')) {
    throw new Error(`${relative} must redirect directly addressed raw preview URLs`)
  }
  if (!source.includes("from '~/ui/@Drawer'") || !source.includes('<Drawer')) {
    throw new Error(`${relative} must use the shared route-owned Drawer`)
  }
  if (source.includes('fixed inset-0') || source.includes('shadow-2xl')) {
    throw new Error(`${relative} must not recreate the Drawer as a route-local modal`)
  }
  if (!source.includes('isFullView') || source.includes('isFullView={false}')) {
    throw new Error(`${relative} must render the live article preview in full-view mode`)
  }
}

const parentRoute = readFileSync(
  path.join(communityRoot, 'src/routes/$community/route.tsx'),
  'utf8',
)
if (parentRoute.includes('isKnownCommunityPath')) {
  throw new Error('Community parent route must leave unknown-path ownership to the catch-all route')
}
if (
  parentRoute.includes('return { shell, locale }') ||
  !parentRoute.includes('projectCommunityHead')
) {
  throw new Error('Community parent loader must return a head projection instead of the full shell')
}

const boundary = readFileSync(
  path.join(communityRoot, 'src/components/CommunityBoundary.tsx'),
  'utf8',
)
if (!boundary.includes('useSuspenseQuery(communityQueries.shell(community))')) {
  throw new Error('CommunityBoundary must read the complete shell from Query cache')
}

const graphqlProxy = readFileSync(path.join(communityRoot, 'src/routes/api/graphql.ts'), 'utf8')
if (
  !graphqlProxy.includes('waitUntil(observeCommunityTagPurge(tags))') ||
  graphqlProxy.includes('await purgeCommunityTags')
) {
  throw new Error('Community GraphQL purge must run as a Worker waitUntil task')
}

const communityServer = readFileSync(path.join(communityRoot, 'src/server/community.ts'), 'utf8')
const authTokenReads = communityServer.match(/getAuthToken\(\)/g)?.length || 0
if (authTokenReads !== 2) {
  throw new Error('Only cache policy and the personalized shell may read the auth token')
}

const healthRoute = readFileSync(path.join(communityRoot, 'src/routes/health.ts'), 'utf8')
if (!healthRoute.includes('buildCommunityHealth()')) {
  throw new Error('Community health route must use the typed health.v1 builder')
}

const simpleKanbanCard = readFileSync(
  path.join(repoRoot, 'frontend/core/unit/KanbanThread/KanbanItem/ClassicLayout/Simple.tsx'),
  'utf8',
)
if (
  simpleKanbanCard.includes('useRouter') ||
  !simpleKanbanCard.includes('<Link') ||
  !simpleKanbanCard.includes('previewId')
) {
  throw new Error('Simple Kanban cards must use PlatformLink so Community can mask previews')
}

for (const dependency of [
  '@tanstack/react-query',
  '@tanstack/react-router',
  '@tanstack/react-router-ssr-query',
  '@tanstack/react-start',
]) {
  if (!packageJson.dependencies?.[dependency])
    throw new Error(`Missing Community dependency ${dependency}`)
}

for (const file of [
  'README.md',
  'src/routes/api/graphql.ts',
  'src/routes/internal/cache/revalidate.ts',
  'src/query/queries.ts',
]) {
  if (!existsSync(path.join(communityRoot, file))) throw new Error(`Missing Community file ${file}`)
}

console.log(`Community contract OK (${requiredPaths.length} generated routes checked).`)
