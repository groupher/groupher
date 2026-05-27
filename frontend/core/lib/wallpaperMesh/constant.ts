export const CANVAS_WIDTH = 960
export const CANVAS_HEIGHT = 600
export const PREVIEW_WIDTH = 420
export const PREVIEW_HEIGHT = 260

export const DEFAULT_MESH_COLORS = ['#fbeede', '#d8b9e3'] as const

export const WALLPAPER_TEXTURE = {
  GRAIN: 'grain',
  PIXELATE: 'pixelate',
  SCREENTONE: 'screentone',
  DITHER: 'dither',
} as const

export const WALLPAPER_TEXTURE_SURFACE = {
  WALLPAPER: 'wallpaper',
  PREVIEW: 'preview',
  SWATCH: 'swatch',
} as const

export const WALLPAPER_TEXTURE_OPTIONS = [
  {
    type: WALLPAPER_TEXTURE.GRAIN,
    labelKey: 'dsb.appearance.wallpaper.texture.grain',
  },
  {
    type: WALLPAPER_TEXTURE.PIXELATE,
    labelKey: 'dsb.appearance.wallpaper.texture.pixelate',
  },
  {
    type: WALLPAPER_TEXTURE.SCREENTONE,
    labelKey: 'dsb.appearance.wallpaper.texture.screentone',
  },
  {
    type: WALLPAPER_TEXTURE.DITHER,
    labelKey: 'dsb.appearance.wallpaper.texture.dither',
  },
] as const

export const WALLPAPER_TEXTURE_TYPES = WALLPAPER_TEXTURE_OPTIONS.map(({ type }) => type)
