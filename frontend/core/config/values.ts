const readPublicEnv = (name: string, fallback: string): string => process.env[name] ?? fallback
const publicGraphQLEndpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT
const privateGraphQLEndpoint = process.env.GRAPHQL_ENDPOINT

export const PAGE_SIZE = {
  S: 10,
  D: 20,
  M: 30,
  L: 40,
} as const

// ENV move later
export const ASSETS_ENDPOINT = readPublicEnv(
  'NEXT_PUBLIC_ASSETS_ENDPOINT',
  'https://static.groupher.com',
)
export const ASSETS_HUB_ENDPOINT = readPublicEnv(
  'NEXT_PUBLIC_ASSETS_HUB_ENDPOINT',
  'http://127.0.0.1:8002',
)
export const ASSETS_HUB_READ_ENDPOINT = readPublicEnv(
  'NEXT_PUBLIC_ASSETS_HUB_READ_ENDPOINT',
  'https://assets.groupher.localhost',
)
export const ICON = readPublicEnv('NEXT_PUBLIC_ICON', 'https://static.groupher.com/icons/static')
export const ICON_BASE = readPublicEnv('NEXT_PUBLIC_ICON_BASE', 'https://static.groupher.com/icons')
export const GRAPHQL_ENDPOINT =
  (typeof window === 'undefined' ? privateGraphQLEndpoint : publicGraphQLEndpoint) ??
  publicGraphQLEndpoint ??
  (() => {
    return 'http://localhost:4001/graphiql'
  })()
export const SITE_URL = readPublicEnv('NEXT_PUBLIC_SITE_URL', 'https://groupher.com')
