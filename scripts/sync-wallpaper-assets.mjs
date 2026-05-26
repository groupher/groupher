import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const sourceDir = path.join(repoRoot, 'frontend/core/assets/wallpaper')
const pictureDir = path.join(sourceDir, 'picture')
const previewDir = path.join(sourceDir, 'picture-preview')
const generatedFile = path.join(repoRoot, 'frontend/core/constant/wallpaper.generated.ts')
const allowedApps = ['main', 'dashboard', 'landing']
const allowedTypes = ['picture', 'picture-preview', 'pattern']
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const webpExtension = '.webp'
const pictureMaxBytes = 500_000
const previewMaxBytes = 50_000
const requestedApps = process.argv.slice(2)
const targetApps = requestedApps.length > 0 ? requestedApps : allowedApps

if (!existsSync(sourceDir)) {
  throw new Error(`Wallpaper source directory not found: ${sourceDir}`)
}

if (!existsSync(pictureDir)) {
  throw new Error(`Wallpaper picture directory not found: ${pictureDir}`)
}

mkdirSync(previewDir, { recursive: true })

const listPictureFiles = () =>
  readdirSync(pictureDir)
    .filter((file) => imageExtensions.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))

const listWebpPictureFiles = () =>
  readdirSync(pictureDir)
    .filter((file) => path.extname(file).toLowerCase() === webpExtension)
    .sort((a, b) => a.localeCompare(b))

const toSlug = (file, duplicatedStems) => {
  const ext = path.extname(file)
  const stem = path.basename(file, ext)

  if (!duplicatedStems.has(stem)) return stem

  return `${stem}-${ext.slice(1)}`
}

const getWebpFileName = (file, duplicatedStems) => `${toSlug(file, duplicatedStems)}${webpExtension}`

const renderWebp = async (source, width, quality) =>
  sharp(source, { failOn: 'none' })
    .rotate()
    .resize({
      width,
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 6 })
    .toBuffer()

const compressToTarget = async ({ source, target, file, maxBytes, widths, qualities }) => {
  let bestImage = null

  for (const width of widths) {
    for (const quality of qualities) {
      const image = await renderWebp(source, width, quality)

      if (!bestImage || image.length < bestImage.length) {
        bestImage = image
      }

      if (image.length <= maxBytes) {
        writeFileSync(target, image)
        return
      }
    }
  }

  if (bestImage.length > maxBytes) {
    throw new Error(
      `Unable to compress ${file} under ${maxBytes} bytes; best was ${bestImage.length} bytes`,
    )
  }

  writeFileSync(target, bestImage)
}

const ensurePicture = async (file, duplicatedStems) => {
  const targetFile = getWebpFileName(file, duplicatedStems)
  const source = path.join(pictureDir, file)
  const target = path.join(pictureDir, targetFile)

  if (path.extname(file).toLowerCase() === webpExtension && file === targetFile) {
    const { size } = statSync(source)

    if (size > pictureMaxBytes) {
      throw new Error(
        `Existing WebP picture exceeds ${pictureMaxBytes} bytes for ${file}; got ${size} bytes`,
      )
    }

    return targetFile
  }

  await compressToTarget({
    source,
    target,
    file,
    maxBytes: pictureMaxBytes,
    widths: [1920, 1680, 1440, 1280, 1120, 960, 800],
    qualities: [82, 76, 70, 64, 58, 52, 46, 40],
  })

  return targetFile
}

const removeSourceInputs = (sourceFiles, webpFiles) => {
  const keptFiles = new Set(webpFiles)

  for (const file of sourceFiles) {
    const ext = path.extname(file).toLowerCase()

    if (ext === webpExtension && keptFiles.has(file)) continue

    unlinkSync(path.join(pictureDir, file))
  }
}

const renderPreview = async (source, width, quality) => {
  const preview = sharp(source, { failOn: 'none' }).resize({
    width,
    withoutEnlargement: true,
  })

  return preview.webp({ quality, effort: 6 }).toBuffer()
}

const ensurePreview = async (file) => {
  const source = path.join(pictureDir, file)
  const target = path.join(previewDir, file)
  let bestPreview = null

  for (const width of [520, 460, 400, 340, 280, 220, 180, 140]) {
    for (const quality of [76, 68, 60, 52, 44, 36, 28]) {
      const preview = await renderPreview(source, width, quality)

      if (!bestPreview || preview.length < bestPreview.length) {
        bestPreview = preview
      }

      if (preview.length <= previewMaxBytes) {
        writeFileSync(target, preview)
        return
      }
    }
  }

  if (bestPreview.length > previewMaxBytes) {
    throw new Error(
      `Unable to compress preview under ${previewMaxBytes} bytes for ${file}; best was ${bestPreview.length} bytes`,
    )
  }

  writeFileSync(target, bestPreview)
}

const getDuplicatedStems = (files) => {
  const counts = new Map()

  for (const file of files) {
    const stem = path.basename(file, path.extname(file))
    counts.set(stem, (counts.get(stem) ?? 0) + 1)
  }

  return new Set([...counts].filter(([, count]) => count > 1).map(([stem]) => stem))
}

const formatObjectKey = (key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`)

const generateManifest = (files) => {
  const duplicatedStems = getDuplicatedStems(files)
  const entries = files
    .map((file) => {
      const slug = toSlug(file, duplicatedStems)

      return `  ${formatObjectKey(slug)}: {
    image: '/wallpaper/picture/${file}',
    preview: '/wallpaper/picture-preview/${file}',
  },`
    })
    .join('\n')

  const content = `import type { TWallpaper } from '~/spec'

/*
 * This file is generated by scripts/sync-wallpaper-assets.mjs.
 *
 * Mechanism:
 * - Every non-WebP image file placed in frontend/core/assets/wallpaper/picture
 *   is converted to WebP and included. Existing WebP files are treated as
 *   already compressed and are only size-checked.
 * - The wallpaper source key is the WebP file stem. If multiple source files
 *   share the same stem, the original extension is appended before conversion
 *   to avoid overwriting entries.
 * - Non-WebP source images are compressed into
 *   frontend/core/assets/wallpaper/picture and the script fails if a picture
 *   cannot be compressed under 500KB. Existing WebP pictures must already be
 *   under 500KB.
 * - Moving a file out of picture/ is the way to remove it from the picker.
 * - Each picture must have a matching file with the same filename in
 *   frontend/core/assets/wallpaper/picture-preview. The script creates missing
 *   previews before writing this manifest and fails if a preview cannot be
 *   compressed under 50KB.
 * - Picker cards must render preview, while the actual selected wallpaper renders image.
 *
 * Do not edit this file by hand; edit the assets folder and run yarn sync:wallpaper.
 */
export const PATTERN_WALLPAPER = {
${entries}
} satisfies Record<string, TWallpaper>
`

  writeFileSync(generatedFile, content)
  console.log(
    `[sync-wallpaper-assets] generated ${path.relative(repoRoot, generatedFile)} with ${files.length} pictures`,
  )
}

const copyAssetDir = (source, target) => {
  mkdirSync(target, { recursive: true })

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue

    cpSync(path.join(source, entry.name), path.join(target, entry.name), { recursive: true })
  }
}

const pictureFiles = listPictureFiles()
const duplicatedStems = getDuplicatedStems(pictureFiles)
const webpPictureFiles = await Promise.all(
  pictureFiles.map((file) => ensurePicture(file, duplicatedStems)),
)
removeSourceInputs(pictureFiles, webpPictureFiles)

const syncedPictureFiles = listWebpPictureFiles()
rmSync(previewDir, { recursive: true, force: true })
mkdirSync(previewDir, { recursive: true })
await Promise.all(syncedPictureFiles.map(ensurePreview))
generateManifest(syncedPictureFiles)

for (const app of targetApps) {
  if (!allowedApps.includes(app)) {
    throw new Error(`Unsupported target app "${app}". Allowed values: ${allowedApps.join(', ')}`)
  }

  const targetRoot = path.join(repoRoot, `frontend/${app}/public/wallpaper`)

  if (existsSync(targetRoot)) {
    rmSync(targetRoot, { recursive: true, force: true })
  }

  mkdirSync(targetRoot, { recursive: true })

  for (const type of allowedTypes) {
    const sourceTypeDir = path.join(sourceDir, type)
    const targetTypeDir = path.join(targetRoot, type)

    if (!existsSync(sourceTypeDir)) continue

    copyAssetDir(sourceTypeDir, targetTypeDir)

    const fileCount = readdirSync(targetTypeDir).length
    console.log(
      `[sync-wallpaper-assets] synced ${fileCount} files -> frontend/${app}/public/wallpaper/${type}`,
    )
  }
}
