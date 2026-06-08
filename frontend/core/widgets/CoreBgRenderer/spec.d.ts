import type { TCoreBgRenderSpec } from '~/lib/coreBg/spec'

/**
 * Optional preview subscription hook for adapter components.
 *
 * Wallpaper uses this to inject global dashboard preview events. CoverEditor can
 * skip it and pass render spec changes directly from its active editor draft.
 *
 * @example
 * const previewSubscriber: TCoreBgPreviewSubscriber = (listener) =>
 *   subscribePreview((state) => listener(state ? resolveSpec(state) : null))
 */
export type TCoreBgPreviewSubscriber = (
  listener: (renderSpec: TCoreBgRenderSpec | null) => void,
) => () => void

/**
 * Props for the shared CoreBg renderer.
 *
 * This component renders actual backgrounds, not only thumbnails. Global Wallpaper,
 * Wallpaper previews, and CoverEditor backgrounds should all use this component
 * with render specs produced by `resolveCoreBgRenderSpec`.
 *
 * @example
 * <CoreBgRenderer renderSpec={renderSpec} className="absolute inset-0" />
 */
export type TProps = {
  className?: string
  renderSpec: TCoreBgRenderSpec
  patternSize?: string
  positioned?: boolean
  previewSubscriber?: TCoreBgPreviewSubscriber
  textureScale?: number
}

/**
 * Internal layer props used for active/exiting crossfade layers.
 */
export type TCoreBgLayerProps = {
  className?: string
  renderSpec: TCoreBgRenderSpec
  exiting?: boolean
  patternSize: string
  textureScale: number
  onExited?: () => void
}
