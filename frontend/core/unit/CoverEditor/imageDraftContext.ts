import { createContext, use } from 'react'

import type { TCoverImageConfig, TCoverImagePatch, TCoverImages, TCoverImageWhich } from './spec'

type TImagePatchOptions = {
  raise?: boolean
}

export type TCoverImageDraftPatch = Partial<Record<TCoverImageWhich, TCoverImageConfig | null>>

export type TCoverImageDraftContext = {
  images: TCoverImages
  activeImageWhich: TCoverImageWhich
  activeImage: TCoverImageConfig | null
  activateImageDraft: (which: TCoverImageWhich) => void
  scheduleImagePatch: (
    which: TCoverImageWhich,
    patch: TCoverImagePatch,
    options?: TImagePatchOptions,
  ) => void
  commitImagePatch: (
    which: TCoverImageWhich,
    patch: TCoverImagePatch,
    options?: TImagePatchOptions,
  ) => void
  flushImageDraft: () => void
  clearImageDraft: () => void
}

export const ImageDraftContext = createContext<TCoverImageDraftContext | null>(null)
ImageDraftContext.displayName = 'CoverImageDraft'

export const useImageDraftContext = (): TCoverImageDraftContext => {
  const context = use(ImageDraftContext)

  if (!context) {
    throw new Error('useImageDraftContext must be used inside ImageDraftProvider')
  }

  return context
}
