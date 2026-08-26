/**
 * Implements the Scripts Generate Feedback Data boundary inside Inspire Me.
 *
 * Business position:
 *
 *   Research dataset
 *     -> TanStack Start / Worker UI
 *     -> researcher
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const dataDir = path.resolve(rootDir, 'data/feedback-platforms')
const outputDir = path.resolve(rootDir, 'public/feedback-platforms')
const legacyOutputPath = path.resolve(rootDir, 'public/feedback-platforms.generated.json')

const PLATFORM_NAMES = {
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

const fileNames = (await fs.readdir(dataDir))
  .filter((fileName) => /-upvotes-\d+\.md$/.test(fileName))
  .sort()

const platforms = await Promise.all(
  fileNames.map(async (fileName) => {
    const platformId = fileName.replace(/-upvotes-\d+\.md$/, '')
    const markdown = await fs.readFile(path.join(dataDir, fileName), 'utf8')
    const posts = parseFeedbackMarkdown(markdown)

    return {
      id: platformId,
      name: PLATFORM_NAMES[platformId] ?? toTitle(platformId),
      logoPath: `/platform-logos/${platformId}.png`,
      posts,
    }
  }),
)

platforms.sort((a, b) => a.name.localeCompare(b.name))

await fs.rm(outputDir, { force: true, recursive: true })
await fs.rm(legacyOutputPath, { force: true })
await fs.mkdir(outputDir, { recursive: true })

await Promise.all(
  platforms.map((platform) =>
    fs.writeFile(path.join(outputDir, `${platform.id}.json`), `${JSON.stringify(platform)}\n`),
  ),
)

await fs.writeFile(
  path.join(outputDir, 'index.json'),
  `${JSON.stringify(
    platforms.map((platform) => ({
      id: platform.id,
      name: platform.name,
      count: platform.posts.length,
      logoPath: platform.logoPath,
    })),
  )}\n`,
)

function parseFeedbackMarkdown(markdown) {
  const posts = []
  const lines = markdown.split('\n')

  for (let index = 2; index < lines.length; index += 1) {
    const post = parseTableRow(lines[index], index - 2)
    if (post) posts.push(post)
  }

  return posts
}

function parseTableRow(line, index) {
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

function parseFormattedNumber(value) {
  const parsed = Number.parseInt(unescapeMarkdown(value).replace(/[,_\s]/g, ''), 10)

  return Number.isFinite(parsed) ? parsed : null
}

function splitMarkdownTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells = []
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

function parseTitleCell(cell) {
  const match = cell.match(/^\[(.*)\]\((https?:\/\/.*?)\)(?:<br>(.*))?$/)
  if (!match) return null

  return {
    titleEn: cleanText(match[1]),
    sourceUrl: match[2],
    titleZh: cleanText(match[3] || match[1]),
  }
}

function parseBilingualCell(cell) {
  const [en, zh] = cell.split(/<br><br>/)

  return {
    en: cleanText(en),
    zh: cleanText(zh || en),
  }
}

function cleanText(text = '') {
  return decodeHtml(unescapeMarkdown(text.replace(/<br>/g, '\n')))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function unescapeMarkdown(text) {
  return text.replace(/\\([\\[\]|])/g, '$1')
}

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function toTitle(value) {
  const parts = []

  for (const part of value.split(/[-_]/)) {
    if (part) parts.push(part.slice(0, 1).toUpperCase() + part.slice(1))
  }

  return parts.join(' ')
}
