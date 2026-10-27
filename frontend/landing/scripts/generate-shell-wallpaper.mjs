import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const patternPath = path.resolve(scriptDir, '../../core/assets/wallpaper/pattern/01.png')
const outputDir = path.resolve(scriptDir, '../public/landing/wallpaper')

// Mirrors the Landing seed and the responsive profiles in core/lib/wallpaperProfiles.ts.
const profiles = {
  wide: [1920, 1080],
  desktop: [1440, 900],
  tablet: [1024, 1366],
  phone: [390, 844],
}
const patternWidth = 260
const patternOpacity = 0.16

const source = await readFile(patternPath)
const pattern = await sharp(source).resize({ width: patternWidth }).ensureAlpha().raw().toBuffer({
  resolveWithObject: true,
})

// The source PNG is an alpha mask. Render its visible strokes in the seed's dark tone.
for (let offset = 0; offset < pattern.data.length; offset += 4) {
  pattern.data[offset] = 0
  pattern.data[offset + 1] = 0
  pattern.data[offset + 2] = 0
  pattern.data[offset + 3] = Math.round(pattern.data[offset + 3] * patternOpacity)
}

const tile = await sharp(pattern.data, { raw: pattern.info }).png().toBuffer()
await mkdir(outputDir, { recursive: true })

for (const [profile, [width, height]] of Object.entries(profiles)) {
  const gradient = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="wallpaper" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FBEFDE"/><stop offset="1" stop-color="#D8B9E3"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#wallpaper)"/></svg>`,
  )

  await sharp(gradient)
    .composite([{ input: tile, tile: true }])
    .webp({ quality: 86 })
    .toFile(path.join(outputDir, `amber-mauve-${profile}.webp`))
}
