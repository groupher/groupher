import type { TWallpaperRenderDescriptor } from '~/lib/wallpaperRenderer/spec'

export type TProps = {
  className?: string
  patternSize?: string
  positioned?: boolean
  textureScale?: number
}

export type TWallpaperLayerProps = {
  className?: string
  descriptor: TWallpaperRenderDescriptor
  exiting?: boolean
  patternSize: string
  textureScale: number
  onExited?: () => void
}
