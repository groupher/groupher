import type { TGradientRecipe, TMeshGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'

export type TWallpaperRenderKind =
  | 'none'
  | 'linear-gradient'
  | 'radial-gradient'
  | 'mesh-gradient'
  | 'image'

export type TWallpaperRenderDescriptor = {
  kind: TWallpaperRenderKind
  background: string
  filter: string
  hasPattern: boolean
  patternImage: string
  hasTexture: boolean
  source: string
  bgSize: string
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
