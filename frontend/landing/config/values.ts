const readPublicEnv = (name: string, fallback: string): string => process.env[name] ?? fallback

export const PAGE_SIZE = {
  S: 10,
  D: 20,
  M: 30,
  L: 40,
} as const

export const TAG_COLORS = [
  'RED',
  'ORANGE',
  'YELLOW',
  'GREEN',
  'CYAN',
  'BLUE',
  'PURPLE',
  'PINK',
  'GREY',
] as const

export const TAG_COLOR_ORDER = {
  red: 0,
  orange: 1,
  yellow: 2,
  green: 3,
  cyan: 4,
  blue: 5,
  purple: 6,
  dodgerblue: 7,
  yellowgreen: 8,
  brown: 9,
  cadetblue: 10,
  grey: 11,
} as const

export const ASSETS_ENDPOINT = readPublicEnv(
  'NEXT_PUBLIC_ASSETS_ENDPOINT',
  'https://static.groupher.com',
)
export const ICON = readPublicEnv('NEXT_PUBLIC_ICON', 'https://static.groupher.com/icons/static')
export const ICON_BASE = readPublicEnv('NEXT_PUBLIC_ICON_BASE', 'https://static.groupher.com/icons')

export const GRAPHQL_ENDPOINT = readPublicEnv(
  'NEXT_PUBLIC_GRAPHQL_ENDPOINT',
  'http://127.0.0.1:4001/graphiql',
)
export const SITE_URL = readPublicEnv('NEXT_PUBLIC_SITE_URL', 'https://groupher.com')
export const SITE_NAME = 'Groupher'
export const SITE_SLOGAN =
  '让你的产品听见用户的声音。互动讨论、看板、更新日志、帮助文档多合一，收集整理用户用户反馈，助你打造更好的产品。'
export const GITHUB = readPublicEnv('NEXT_PUBLIC_GITHUB', 'https://github.com/groupher')

export const EMAIL_SUPPORT = readPublicEnv('NEXT_PUBLIC_EMAIL_SUPPORT', 'groupher@outlook.com')
