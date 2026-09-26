import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
for (const query of [
  'Q.community.config(community)',
  'Q.dsb.config(community)',
  'Q.wallpaper.config(community)',
]) {
  if (!boundary.includes(`useSuspenseQuery(${query})`)) {
    throw new Error(`CommunityBoundary must read ${query} from its canonical Query key`)
  }
}

const graphqlProxy = readFileSync(path.join(communityRoot, 'src/routes/api/graphql.ts'), 'utf8')
if (
  !graphqlProxy.includes('POST: ({ request }) => proxyGraphQLRequest(request)') ||
  /waitUntil|purgeCommunityTags|mutationCacheEffect|revalidation/.test(graphqlProxy)
) {
  throw new Error('Community GraphQL must only proxy to Phoenix; cache purge is Phoenix-owned')
}

const communityServer = readFileSync(path.join(communityRoot, 'src/server/community.ts'), 'utf8')
const authTokenReads = communityServer.match(/getAuthToken\(\)/g)?.length || 0
if (authTokenReads !== 0) {
  throw new Error('Public Community loaders must not read the auth token')
}

const stripTypeScriptComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')

const collectSourceFiles = (directory) => {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collectSourceFiles(absolute))
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(absolute)
  }
  return files
}

const coreSourceFiles = collectSourceFiles(path.join(repoRoot, 'frontend/core')).filter(
  (absolute) =>
    !absolute.includes(`${path.sep}lib${path.sep}graphql${path.sep}generated${path.sep}`),
)
const forbiddenCompatibility = [
  'mutationCacheTags',
  'revalidateCommunityCache',
  'community$.commit',
  'ArticleMutationBridge',
  'UPVOTE_ARTICLE',
  'makeDsbResponseFieldReader',
]
for (const token of forbiddenCompatibility) {
  const callers = coreSourceFiles.filter((absolute) =>
    readFileSync(absolute, 'utf8').includes(token),
  )
  if (callers.length > 0) {
    throw new Error(
      `Removed Query/Store compatibility '${token}' returned in: ${callers
        .map((absolute) => path.relative(repoRoot, absolute))
        .join(', ')}`,
    )
  }
}

const publicQuerySources = [
  ...collectSourceFiles(path.join(communityRoot, 'src/server')),
  ...[
    'schemas/pages/article.fragments.ts',
    'schemas/pages/community.ts',
    'schemas/pages/post.ts',
    'schemas/pages/changelog.ts',
    'schemas/pages/doc.ts',
    'schemas/pages/comment.ts',
  ].map((relative) => path.join(repoRoot, 'frontend/core', relative)),
]
const viewerSelectionFiles = publicQuerySources.filter((absolute) => {
  const source = stripTypeScriptComments(readFileSync(absolute, 'utf8'))
  const hasUnconditionalViewerField = source
    .split('\n')
    .some(
      (line) =>
        /\bviewerHas[A-Za-z0-9_]*\b/.test(line) && !line.includes('@include(if: $userHasLogin)'),
    )
  const enablesViewerSelection = /\buserHasLogin\s*:\s*true\b/.test(source)
  return hasUnconditionalViewerField || enablesViewerSelection
})
if (viewerSelectionFiles.length > 0) {
  throw new Error(
    `Public Community loader/query sources must gate viewer fields and must not enable them: ${viewerSelectionFiles
      .map((absolute) => path.relative(repoRoot, absolute))
      .join(', ')}`,
  )
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
  !simpleKanbanCard.includes('<CommunityPreviewLink') ||
  !simpleKanbanCard.includes('previewId')
) {
  throw new Error(
    'Simple Kanban cards must use CommunityPreviewLink so Community can mask previews',
  )
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

for (const file of ['README.md', 'src/routes/api/graphql.ts', 'src/query/queries.ts']) {
  if (!existsSync(path.join(communityRoot, file))) throw new Error(`Missing Community file ${file}`)
}

console.log(`Community contract OK (${requiredPaths.length} generated routes checked).`)
