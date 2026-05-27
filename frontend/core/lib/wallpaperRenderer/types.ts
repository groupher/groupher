import type { TMeshGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'

export type TWallpaperRenderKind = 'none' | 'linear-gradient' | 'mesh-gradient' | 'image'

export type TWallpaperRenderDescriptor = {
  kind: TWallpaperRenderKind
  background: string
  filter: string
  hasPattern: boolean
  source: string
  bgSize: string
  colors: string[]
  flow: number
  texture: TWallpaperTexture
  blurIntensity: number
  brightness: number
  saturation: number
  meshRecipe: TMeshGradientRecipe | null
  imageUrl: string
}
