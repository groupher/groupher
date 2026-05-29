export const CANVAS_WIDTH = 960
export const CANVAS_HEIGHT = 600
export const PREVIEW_WIDTH = 420
export const PREVIEW_HEIGHT = 260

export const DEFAULT_MESH_COLORS = ['#fbeede', '#d8b9e3'] as const
export const DEFAULT_WALLPAPER_TEXTURE_INTENSITY = 45

export const GRADIENT_TYPE = {
  LINEAR: 'linear',
  RADIAL: 'radial',
  MESH: 'mesh',
} as const

export const MESH_GRADIENT_MODEL = {
  HAZE: 'haze',
  RIDGE: 'ridge',
  BRUSHED: 'brushed',
  RIBBON: 'ribbon',
  SCANLINE: 'scanline',
  GLOW: 'glow',
} as const

export const WALLPAPER_TEXTURE = {
  NOISE: 'noise',
  TILE: 'tile',
  BEAM: 'beam',
  ASCII: 'ascii',
  DOTS: 'dots',
} as const

export const WALLPAPER_TEXTURE_SURFACE = {
  WALLPAPER: 'wallpaper',
  PREVIEW: 'preview',
  SWATCH: 'swatch',
} as const

export const WALLPAPER_TEXTURE_OPTIONS = [
  {
    type: WALLPAPER_TEXTURE.NOISE,
    labelKey: 'dsb.appearance.wallpaper.texture.noise',
  },
  {
    type: WALLPAPER_TEXTURE.TILE,
    labelKey: 'dsb.appearance.wallpaper.texture.tile',
  },
  {
    type: WALLPAPER_TEXTURE.BEAM,
    labelKey: 'dsb.appearance.wallpaper.texture.beam',
  },
  {
    type: WALLPAPER_TEXTURE.ASCII,
    labelKey: 'dsb.appearance.wallpaper.texture.ascii',
  },
  {
    type: WALLPAPER_TEXTURE.DOTS,
    labelKey: 'dsb.appearance.wallpaper.texture.dots',
  },
] as const

export const WALLPAPER_TEXTURE_TYPES = WALLPAPER_TEXTURE_OPTIONS.map(({ type }) => type)
