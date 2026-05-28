import type { TMeshGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TCustomWallpaper, TWallpaperType } from '~/spec'

export type TWallpaperState = {
  customWallpaper: TCustomWallpaper
  source: string
  type: TWallpaperType

  hasPattern: boolean
  hasTexture: boolean
  gradientDeg: number
  blurIntensity: number
  hasShadow: boolean
  brightness: number
  saturation: number
  mesh: TMeshGradientRecipe | null
  texture: TWallpaperTexture

  bgSize: string
}

export type TStore = TWallpaperState & {
  original: TWallpaperState
  // actions
  commit: (patch: Partial<TStore>) => void
}

export type TInit = Partial<TStore>
