import fs from 'node:fs/promises'
import path from 'node:path'

export type FeedbackPost = {
  id: string
  titleEn: string
  titleZh: string
  digestEn: string
  digestZh: string
  sourceUrl: string
  upvotes: number
  comments: number | null
}

export type FeedbackPlatform = {
  id: string
  name: string
  count: number
  logoPath: string
  posts: FeedbackPost[]
}

const PLATFORM_NAMES: Record<string, string> = {
  announcekit: 'AnnounceKit',
  canny: 'Canny',
  featurebase: 'Featurebase',
  featureos: 'FeatureOS',
  feedbear: 'FeedBear',
  fider: 'Fider',
  flarum: 'Flarum',
  frill: 'Frill',
  nolt: 'Nolt',
  rapidr: 'Rapidr',
  uservoice: 'UserVoice',
  zendesk: 'Zendesk',
}

let platformCache: FeedbackPlatform[] | null = null

export async function getFeedbackPlatforms(): Promise<FeedbackPlatform[]> {
  if (platformCache && process.env.NODE_ENV === 'production') return platformCache

  const dataDir = path.resolve(process.cwd(), 'data/feedback-platforms')
  const fileNames = await fs.readdir(dataDir)
  const markdownFiles = fileNames.filter((fileName) => /-upvotes-\d+\.md$/.test(fileName)).sort()

  const platforms = await Promise.all(
    markdownFiles.map(async (fileName) => {
      const platformId = fileName.replace(/-upvotes-\d+\.md$/, '')
      const markdown = await fs.readFile(path.join(dataDir, fileName), 'utf8')
      const posts = parseFeedbackMarkdown(markdown)

      return {
        id: platformId,
        name: PLATFORM_NAMES[platformId] ?? toTitle(platformId),
        count: posts.length,
        logoPath: `/platform-logos/${platformId}.png`,
        posts,
      }
    }),
  )

  const sortedPlatforms = platforms.sort((a, b) => a.name.localeCompare(b.name))

  platformCache = sortedPlatforms
  return platformCache
}

function parseFeedbackMarkdown(markdown: string): FeedbackPost[] {
  const posts: FeedbackPost[] = []
  const lines = markdown.split('\n')

  for (let index = 2; index < lines.length; index += 1) {
    const post = parseTableRow(lines[index], index - 2)
    if (post) posts.push(post)
  }

  return posts
}

function parseTableRow(line: string, index: number): FeedbackPost | null {
  if (!line.trim()) return null

  const cells = splitMarkdownTableRow(line)
  if (cells.length < 4) return null

  const title = parseTitleCell(cells[0])
  if (!title) return null

  const digest = parseBilingualCell(cells[1])
  const upvotes = parseFormattedNumber(cells[2]) ?? 0
  const commentsValue = parseFormattedNumber(cells[3])

  return {
    id: `${title.sourceUrl}-${index}`,
    ...title,
    digestEn: digest.en,
    digestZh: digest.zh,
    upvotes,
    comments: commentsValue,
  }
}

function parseFormattedNumber(value: string): number | null {
  const parsed = Number.parseInt(unescapeMarkdown(value).replace(/[,_\s]/g, ''), 10)

  return Number.isFinite(parsed) ? parsed : null
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let current = ''
  let escaped = false

  for (const char of trimmed) {
    if (escaped) {
      current += `\\${char}`
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function parseTitleCell(
  cell: string,
): Pick<FeedbackPost, 'titleEn' | 'titleZh' | 'sourceUrl'> | null {
  const match = cell.match(/^\[(.*)\]\((https?:\/\/.*?)\)(?:<br>(.*))?$/)
  if (!match) return null

  return {
    titleEn: cleanText(match[1]),
    sourceUrl: match[2],
    titleZh: cleanText(match[3] || match[1]),
  }
}

function parseBilingualCell(cell: string): { en: string; zh: string } {
  const [en, zh] = cell.split(/<br><br>/)

  return {
    en: cleanText(en),
    zh: cleanText(zh || en),
  }
}

function cleanText(text = ''): string {
  return decodeHtml(unescapeMarkdown(text.replace(/<br>/g, '\n')))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function unescapeMarkdown(text: string): string {
  return text.replace(/\\([\\[\]|])/g, '$1')
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function toTitle(value: string): string {
  const parts: string[] = []

  for (const part of value.split(/[-_]/)) {
    if (part) parts.push(part.slice(0, 1).toUpperCase() + part.slice(1))
  }

  return parts.join(' ')
}
