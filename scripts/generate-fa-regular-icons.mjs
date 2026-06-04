import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import * as regularIcons from '@fortawesome/free-regular-svg-icons'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { optimize } from 'svgo'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)

const assetsRoot = path.join(repoRoot, 'frontend/core/assets/icons')
const rawRoot = path.join(assetsRoot, 'raw')
const generatedRoot = path.join(assetsRoot, 'generated')
const optimizedRoot = path.join(generatedRoot, 'optimized')
const spritesRoot = path.join(generatedRoot, 'sprites')
const indexFile = path.join(repoRoot, 'frontend/core/widgets/IconHub/icons.ts')
const heroiconsDir = path.join(repoRoot, 'node_modules/@heroicons/react/24/outline')
const lucideDir = path.join(repoRoot, 'node_modules/lucide-static/icons')
const phosphorDir = path.join(repoRoot, 'node_modules/@phosphor-icons/core/assets/regular')
const PROVIDERS = ['fa', 'lucide', 'heroicons', 'phosphor']
const LEGACY_PROVIDER_DIRS = [...PROVIDERS, 'providers']

const resetDir = (dir) => {
  mkdirSync(dir, { recursive: true })
  for (const file of readdirSync(dir)) {
    rmSync(path.join(dir, file), { recursive: true, force: true })
  }
}

const ensureCleanDir = (...segments) => {
  const dir = path.join(...segments)
  resetDir(dir)
  return dir
}

const writeSvg = (dir, file, svg) => {
  writeFileSync(path.join(dir, file), svg.endsWith('\n') ? svg : `${svg}\n`, 'utf8')
}

const getRawProviderDir = (provider) => ensureCleanDir(rawRoot, provider)

const generateFaRaw = () => {
  const dedupedEntries = new Map()

  for (const icon of Object.values(regularIcons)) {
    if (!icon || typeof icon !== 'object' || !('iconName' in icon) || !('icon' in icon)) continue
    if (!dedupedEntries.has(icon.iconName)) {
      dedupedEntries.set(icon.iconName, { iconName: icon.iconName, icon: icon.icon })
    }
  }

  const entries = Array.from(dedupedEntries.values()).sort((a, b) =>
    a.iconName.localeCompare(b.iconName),
  )
  const dir = getRawProviderDir('fa')

  for (const entry of entries) {
    const [width, height, , , svgPathData] = entry.icon
    const paths = Array.isArray(svgPathData) ? svgPathData : [svgPathData]
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`,
      ...paths.map((d) => `  <path d="${d}"/>`),
      '</svg>',
      '',
    ].join('\n')

    writeSvg(dir, `${entry.iconName}.svg`, svg)
  }

  return entries.map((entry) => entry.iconName)
}

const copyRawSvgProvider = (provider, sourceDir) => {
  const dir = getRawProviderDir(provider)
  const names = readdirSync(sourceDir)
    .filter((file) => file.endsWith('.svg'))
    .sort()

  for (const file of names) {
    copyFileSync(path.join(sourceDir, file), path.join(dir, file))
  }

  return names.map((file) => file.replace(/\.svg$/, ''))
}

const toKebabCase = (value) =>
  value
    .replace(/Icon$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()

const generateHeroiconsRaw = () => {
  const dir = getRawProviderDir('heroicons')
  const files = readdirSync(heroiconsDir)
    .filter((file) => file.endsWith('.js') && file !== 'index.js')
    .sort()

  const iconNames = []

  for (const file of files) {
    const componentName = file.replace(/\.js$/, '')
    const iconName = toKebabCase(componentName)
    const Component = require(path.join(heroiconsDir, file))
    const svg = renderToStaticMarkup(React.createElement(Component))

    writeSvg(dir, `${iconName}.svg`, svg)
    iconNames.push(iconName)
  }

  return iconNames
}

const copyProviderLogosToRaw = () => {
  const legacyProviderDir = path.join(assetsRoot, 'providers')
  const rawProviderDir = path.join(rawRoot, 'providers')

  if (!existsSync(rawProviderDir) && existsSync(legacyProviderDir)) {
    mkdirSync(rawProviderDir, { recursive: true })
    for (const file of readdirSync(legacyProviderDir)) {
      copyFileSync(path.join(legacyProviderDir, file), path.join(rawProviderDir, file))
    }
  }
}

const optimizeSvg = (svg, filePath) => {
  const result = optimize(svg, {
    path: filePath,
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            cleanupIds: false,
          },
        },
      },
      'removeDimensions',
    ],
  })

  return result.data
}

const parseAttributes = (tag) => {
  const attributes = {}
  const pattern = /([:\w-]+)\s*=\s*(['"])(.*?)\2/g
  let match = pattern.exec(tag)

  while (match) {
    attributes[match[1]] = match[3]
    match = pattern.exec(tag)
  }

  return attributes
}

const extractSvgParts = (svg) => {
  const normalized = svg
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!doctype[\s\S]*?>/gi, '')
    .trim()
  const openTagMatch = normalized.match(/<svg\b[^>]*>/i)

  if (!openTagMatch) {
    throw new Error('Invalid SVG: missing <svg> tag')
  }

  const attrs = parseAttributes(openTagMatch[0])
  const viewBox = attrs.viewBox || attrs.viewbox
  const inner = normalized
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim()

  if (!viewBox) {
    throw new Error('Invalid SVG: missing viewBox')
  }

  return { attrs, inner, viewBox }
}

const symbolAttrsFromSvg = (attrs) => {
  const inheritedAttrs = [
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'fill-rule',
    'clip-rule',
  ]
  const parts = []

  for (const attr of inheritedAttrs) {
    if (attrs[attr]) parts.push(`${attr}="${attrs[attr]}"`)
  }

  if (!attrs.fill && !attrs.stroke) {
    parts.push('fill="currentColor"')
  }

  return parts.join(' ')
}

const optimizeProvider = (provider, iconNames) => {
  const rawDir = path.join(rawRoot, provider)
  const optimizedDir = ensureCleanDir(optimizedRoot, provider)
  const symbols = []

  for (const iconName of iconNames) {
    const file = `${iconName}.svg`
    const rawFile = path.join(rawDir, file)
    const optimizedSvg = optimizeSvg(readFileSync(rawFile, 'utf8'), rawFile)
    const { attrs, inner, viewBox } = extractSvgParts(optimizedSvg)

    writeSvg(optimizedDir, file, optimizedSvg)

    const symbolAttrs = symbolAttrsFromSvg(attrs)
    const attrsPart = symbolAttrs ? ` ${symbolAttrs}` : ''
    symbols.push(
      `  <symbol id="${provider}-${iconName}" viewBox="${viewBox}"${attrsPart}>${inner}</symbol>`,
    )
  }

  const sprite = [
    '<svg xmlns="http://www.w3.org/2000/svg">',
    ...symbols,
    '</svg>',
    '',
  ].join('\n')

  writeSvg(spritesRoot, `${provider}.sprite.svg`, sprite)
}

const cleanupLegacyProviderDirs = () => {
  for (const provider of LEGACY_PROVIDER_DIRS) {
    rmSync(path.join(assetsRoot, provider), { recursive: true, force: true })
  }
}

mkdirSync(assetsRoot, { recursive: true })
copyProviderLogosToRaw()
resetDir(generatedRoot)
mkdirSync(spritesRoot, { recursive: true })

const generated = {
  fa: generateFaRaw(),
  lucide: copyRawSvgProvider('lucide', lucideDir),
  heroicons: generateHeroiconsRaw(),
  phosphor: copyRawSvgProvider('phosphor', phosphorDir),
}

for (const provider of PROVIDERS) {
  optimizeProvider(provider, generated[provider])
}

cleanupLegacyProviderDirs()

const providerSource = PROVIDERS.map((provider) => {
  const entries = generated[provider].map((iconName) => `    '${iconName}',`).join('\n')

  return `  ${provider}: [\n${entries}\n  ],`
}).join('\n')

const indexSource = `// AUTO-GENERATED by scripts/generate-fa-regular-icons.mjs
// Do not edit by hand.

import { PROVIDERS } from './sprite'

export {
  getIconFilePath,
  getIconSpriteHref,
  getIconSpritePath,
  getIconSymbolId,
  PROVIDERS,
} from './sprite'
export type { TIconProvider } from './sprite'

export const PICKER_PROVIDERS = ['all', ...PROVIDERS] as const

export const ICONS = {
${providerSource}
} as const

export type TPickerProvider = (typeof PICKER_PROVIDERS)[number]
export type TFaIconName = (typeof ICONS)['fa'][number]
export type TLucideIconName = (typeof ICONS)['lucide'][number]
export type THeroiconsIconName = (typeof ICONS)['heroicons'][number]
export type TPhosphorIconName = (typeof ICONS)['phosphor'][number]
export type TIconName =
  | TFaIconName
  | TLucideIconName
  | THeroiconsIconName
  | TPhosphorIconName
export type TRegularIcons = TFaIconName
export type TFaIconMeta = TFaIconName

export const FA_ICONS = ICONS.fa

export default ICONS
`

writeFileSync(indexFile, indexSource, 'utf8')

const providerSummary = PROVIDERS.map((provider) => `${provider}:${generated[provider].length}`).join(
  ', ',
)

console.log(`[generate-fa-regular-icons] generated icon sprites and index (${providerSummary})`)
