import type { TGradientRecipe, TMeshGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TWallpaperBgSize } from '~/spec'

import type { WALLPAPER_RENDER_KIND } from './constant'

export type TWallpaperRenderKind = WALLPAPER_RENDER_KIND

export type TWallpaperRenderDescriptor = {
  kind: TWallpaperRenderKind
  background: string
  filter: string
  hasPattern: boolean
  patternImage: string
  patternOpacity: number
  patternColor: string
  hasTexture: boolean
  source: string
  bgSize: TWallpaperBgSize
  colors: string[]
  colorStops: number[]
  flow: number
  texture: TWallpaperTexture
  blurIntensity: number
  brightness: number
  saturation: number
  gradientRecipe: TGradientRecipe | null
  meshRecipe: TMeshGradientRecipe | null
  imageUrl: string
}
