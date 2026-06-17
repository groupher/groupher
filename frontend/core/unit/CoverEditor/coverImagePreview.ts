import type { TCoverCanvas, TCoverImages, TCoverImageWhich } from './spec'

export const COVER_IMAGE_PREVIEW_EVENT = 'groupher:cover-image-preview'

export type TCoverImagePreviewState = {
  images: TCoverImages
  activeImageWhich: TCoverImageWhich
} & TCoverCanvas

export type TCoverImagePreviewDetail = {
  state: TCoverImagePreviewState | null
}

type TCoverImagePreviewEvent = CustomEvent<TCoverImagePreviewDetail>

export const emitCoverImagePreview = (state: TCoverImagePreviewState | null): void => {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<TCoverImagePreviewDetail>(COVER_IMAGE_PREVIEW_EVENT, {
      detail: { state },
    }),
  )
}

export const subscribeCoverImagePreview = (
  listener: (state: TCoverImagePreviewState | null) => void,
): (() => void) => {
  if (typeof window === 'undefined') return () => undefined

  const handlePreview = (event: Event): void => {
    listener((event as TCoverImagePreviewEvent).detail.state)
  }

  window.addEventListener(COVER_IMAGE_PREVIEW_EVENT, handlePreview)

  return () => window.removeEventListener(COVER_IMAGE_PREVIEW_EVENT, handlePreview)
}
