export const CANVAS_WIDTH = 960
export const CANVAS_HEIGHT = 600
export const PREVIEW_WIDTH = 420
export const PREVIEW_HEIGHT = 260

export const DEFAULT_MESH_COLORS = ['#fbeede', '#d8b9e3'] as const
export const DEFAULT_WALLPAPER_TEXTURE_INTENSITY = 45

export enum GRADIENT_RENDERER {
  LINEAR = 'linear',
  RADIAL = 'radial',
  FLOW = 'flow',
  LIQUID = 'liquid',
}

export const MESH_GRADIENT_RENDERERS = [GRADIENT_RENDERER.FLOW, GRADIENT_RENDERER.LIQUID] as const

export enum GRADIENT_SHAPE {
  CIRCLE = 'circle',
  ELLIPSE = 'ellipse',
}

export const WALLPAPER_GRADIENT_RENDERER_OPTIONS = [
  {
    renderer: GRADIENT_RENDERER.LINEAR,
    labelKey: 'dsb.appearance.wallpaper.renderer.linear',
  },
  {
    renderer: GRADIENT_RENDERER.RADIAL,
    labelKey: 'dsb.appearance.wallpaper.renderer.radial',
  },
  {
    renderer: GRADIENT_RENDERER.FLOW,
    labelKey: 'dsb.appearance.wallpaper.renderer.flow',
  },
  {
    renderer: GRADIENT_RENDERER.LIQUID,
    labelKey: 'dsb.appearance.wallpaper.renderer.liquid',
  },
] as const

export enum WALLPAPER_TEXTURE {
  NOISE = 'noise',
  TILE = 'tile',
  BEAM = 'beam',
  ASCII = 'ascii',
  DOTS = 'dots',
  OIL = 'oil',
}

export enum WALLPAPER_TEXTURE_SURFACE {
  WALLPAPER = 'wallpaper',
  PREVIEW = 'preview',
  SWATCH = 'swatch',
}

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
  {
    type: WALLPAPER_TEXTURE.OIL,
    labelKey: 'dsb.appearance.wallpaper.texture.oil',
  },
] as const

export const WALLPAPER_TEXTURE_TYPES = WALLPAPER_TEXTURE_OPTIONS.map(({ type }) => type)
