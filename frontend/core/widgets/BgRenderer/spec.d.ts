import type { TBgRenderSpec } from '~/lib/bg/spec'

/**
 * Optional preview subscription hook for adapter components.
 *
 * Wallpaper uses this to inject global dashboard preview events. CoverEditor can
 * skip it and pass render spec changes directly from its active editor draft.
 *
 * @example
 * const previewSubscriber: TBgPreviewSubscriber = (listener) =>
 *   subscribePreview((state) => listener(state ? resolveSpec(state) : null))
 */
export type TBgPreviewSubscriber = (
  listener: (renderSpec: TBgRenderSpec | null) => void,
) => () => void

/**
 * Props for the shared Bg renderer.
 *
 * This component renders actual backgrounds, not only thumbnails. Global Wallpaper,
 * Wallpaper previews, and CoverEditor backgrounds should all use this component
 * with render specs produced by `resolveBgRenderSpec`.
 *
 * @example
 * <BgRenderer renderSpec={renderSpec} className="absolute inset-0" />
 */
export type TProps = {
  className?: string
  renderSpec: TBgRenderSpec
  patternSize?: string
  positioned?: boolean
  previewSubscriber?: TBgPreviewSubscriber
  textureScale?: number
}

/**
 * Internal layer props used for active/exiting crossfade layers.
 */
export type TBgLayerProps = {
  className?: string
  renderSpec: TBgRenderSpec
  exiting?: boolean
  patternSize: string
  textureScale: number
  onExited?: () => void
}
