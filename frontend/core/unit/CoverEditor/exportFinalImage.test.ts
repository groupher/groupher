import { createCoverBgConfig } from './background'
import { COVER_IMAGE_WHICH } from './constant'
import { createCoverImageConfig } from './coverImageModel'
import { getCoverExportLayers, resolveCoverExportFilename } from './exportFinalImage'
import type { TCoverConfig } from './spec'

const activeBackground = createCoverBgConfig()

const coverConfig = (patch: Partial<TCoverConfig> = {}): TCoverConfig => ({
  background: {
    dark: activeBackground,
    light: activeBackground,
  },
  activeBackground,
  canvasHeight: 630,
  canvasWidth: 1200,
  images: {
    primary: createCoverImageConfig(COVER_IMAGE_WHICH.PRIMARY, 'primary.png'),
    secondary: null,
  },
  ...patch,
})

describe('cover final image export helpers', () => {
  it('projects the default primary image into the export canvas', () => {
    const [layer] = getCoverExportLayers(coverConfig())

    expect(layer.frameWidth).toBe(1128)
    expect(layer.frameHeight).toBeCloseTo(592.2)
    expect(layer.centerX).toBe(600)
    expect(layer.centerY).toBeCloseTo(315)
    expect(layer.drawX).toBe(-564)
    expect(layer.drawY).toBeCloseTo(-296.1)
  })

  it('sorts image layers by z-index', () => {
    const primary = createCoverImageConfig(COVER_IMAGE_WHICH.PRIMARY, 'primary.png')
    const secondary = createCoverImageConfig(COVER_IMAGE_WHICH.SECONDARY, 'secondary.png')

    const layers = getCoverExportLayers(
      coverConfig({
        images: {
          primary: { ...primary, zIndex: 20 },
          secondary: { ...secondary, zIndex: 10 },
        },
      }),
    )

    expect(layers.map((layer) => layer.image.which)).toEqual([
      COVER_IMAGE_WHICH.SECONDARY,
      COVER_IMAGE_WHICH.PRIMARY,
    ])
  })

  it('matches the default export filename to the mime type', () => {
    expect(resolveCoverExportFilename('image/png')).toBe('cover.png')
    expect(resolveCoverExportFilename('image/jpeg')).toBe('cover.jpg')
    expect(resolveCoverExportFilename('image/webp')).toBe('cover.webp')
    expect(resolveCoverExportFilename('image/jpeg', 'custom.png')).toBe('custom.png')
  })
})
