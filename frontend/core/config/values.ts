const isProd = process.env.NODE_ENV === 'production'

const readPublicEnv = (name: string, fallback: string): string => {
  const value = process.env[name]

  if (value) return value

  if (isProd) {
    throw new Error(`Missing required public env: ${name}`)
  }

  return fallback
}

export const PAGE_SIZE = {
  S: 10,
  D: 20,
  M: 30,
  L: 40,
} as const

export const ASSETS_ENDPOINT = readPublicEnv(
  'NEXT_PUBLIC_ASSETS_ENDPOINT',
  'https://static.groupher.com',
)
export const ICON = readPublicEnv('NEXT_PUBLIC_ICON', 'https://static.groupher.com/icons/static')
export const ICON_BASE = readPublicEnv('NEXT_PUBLIC_ICON_BASE', 'https://static.groupher.com/icons')
export const GRAPHQL_ENDPOINT = readPublicEnv(
  'NEXT_PUBLIC_GRAPHQL_ENDPOINT',
  'http://localhost:4001/graphiql',
)
export const SITE_URL = readPublicEnv('NEXT_PUBLIC_SITE_URL', 'https://groupher.com')
export const SITE_NAME = 'Groupher'
export const SITE_SLOGAN =
  '让你的产品听见用户的声音。互动讨论、看板、更新日志、帮助文档多合一，收集整理用户用户反馈，助你打造更好的产品。'
