import { equals, mergeDeepRight } from 'ramda'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import useDebouncedPreviewCommit from '~/hooks/useDebouncedPreviewCommit'

import {
  COVER_IMAGE_WHICH_LIST,
  getActiveImage,
  getNextActiveImageWhich,
  getRaisedImages,
} from './coverImageModel'
import { emitCoverImagePreview, type TCoverImagePreviewState } from './coverImagePreview'
import type { TCoverImageDraftContext, TCoverImageDraftPatch } from './imageDraftContext'
import type { TCoverImageConfig, TCoverImagePatch, TCoverImages, TCoverImageWhich } from './spec'
import useLogic from './useLogic'

type TImagePatchOptions = {
  raise?: boolean
}

const mergeImagePatch = (image: TCoverImageConfig, patch: TCoverImagePatch): TCoverImageConfig =>
  mergeDeepRight(image, patch) as TCoverImageConfig

const getCommittedSourceKey = (images: TCoverImages): string =>
  COVER_IMAGE_WHICH_LIST.map((which) => images[which]?.source ?? '').join('|')

const getChangedImagesPatch = (
  committedImages: TCoverImages,
  previewImages: TCoverImages,
): TCoverImageDraftPatch =>
  COVER_IMAGE_WHICH_LIST.reduce<TCoverImageDraftPatch>((acc, which) => {
    if (!equals(committedImages[which], previewImages[which])) {
      acc[which] = previewImages[which]
    }

    return acc
  }, {})

const hasImageDraftPatch = (patch: TCoverImageDraftPatch): boolean =>
  COVER_IMAGE_WHICH_LIST.some((which) => which in patch)

export default function useCoverImagePreview(): TCoverImageDraftContext {
  const {
    activeImageWhich: committedActiveImageWhich,
    canvasHeight,
    canvasWidth,
    images: committedImages,
    imagePatchOnChange,
    imagesOnChange,
  } = useLogic()
  const committedState = useMemo<TCoverImagePreviewState>(
    () => ({
      images: committedImages,
      activeImageWhich: committedActiveImageWhich,
      canvasWidth,
      canvasHeight,
    }),
    [
      canvasHeight,
      canvasWidth,
      committedActiveImageWhich,
      committedImages.primary,
      committedImages.secondary,
    ],
  )
  const committedStateRef = useRef(committedState)
  const committedSourceKeyRef = useRef(getCommittedSourceKey(committedImages))
  const previewStateRef = useRef<TCoverImagePreviewState>(committedState)
  const [draftContextState, setDraftContextState] =
    useState<TCoverImagePreviewState>(committedState)
  const pendingPreviewStateRef = useRef<TCoverImagePreviewState | null>(null)
  const imagePatchOnChangeRef = useRef(imagePatchOnChange)
  const imagesOnChangeRef = useRef(imagesOnChange)
  const previewFrameRef = useRef<number | null>(null)
  const clearFrameRef = useRef<number | null>(null)
  const isPreviewingRef = useRef(false)

  committedStateRef.current = committedState

  useEffect(() => {
    imagePatchOnChangeRef.current = imagePatchOnChange
    imagesOnChangeRef.current = imagesOnChange
  }, [imagePatchOnChange, imagesOnChange])

  const publishPreviewState = useCallback((state: TCoverImagePreviewState): void => {
    pendingPreviewStateRef.current = state
    if (previewFrameRef.current !== null) return

    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = null
      const pendingState = pendingPreviewStateRef.current

      if (pendingState) {
        setDraftContextState((current) => (equals(current, pendingState) ? current : pendingState))
      }

      emitCoverImagePreview(pendingState)
    })
  }, [])

  const clearPreviewState = useCallback((): void => {
    isPreviewingRef.current = false
    previewStateRef.current = committedStateRef.current
    pendingPreviewStateRef.current = null

    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current)
      previewFrameRef.current = null
    }

    if (clearFrameRef.current !== null) {
      window.cancelAnimationFrame(clearFrameRef.current)
    }

    clearFrameRef.current = window.requestAnimationFrame(() => {
      clearFrameRef.current = null
      setDraftContextState((current) =>
        equals(current, committedStateRef.current) ? current : committedStateRef.current,
      )
      emitCoverImagePreview(null)
    })
  }, [])

  const setPreviewState = useCallback(
    (nextState: TCoverImagePreviewState): void => {
      if (equals(previewStateRef.current, nextState)) return

      isPreviewingRef.current = true
      previewStateRef.current = nextState
      publishPreviewState(nextState)
    },
    [publishPreviewState],
  )

  const commitDraftImages = useCallback((patch: TCoverImageDraftPatch): void => {
    const images = {
      ...committedStateRef.current.images,
      ...patch,
    } as TCoverImages
    const activeImageWhich = getNextActiveImageWhich(
      images,
      previewStateRef.current.activeImageWhich,
    )
    const nextState = {
      ...committedStateRef.current,
      images,
      activeImageWhich,
    }

    committedStateRef.current = nextState
    previewStateRef.current = nextState
    setDraftContextState(nextState)
    imagesOnChangeRef.current(images, activeImageWhich)
  }, [])

  const {
    schedule: scheduleDraftCommit,
    flush: flushPendingImageDraft,
    clear: clearPendingImageDraft,
  } = useDebouncedPreviewCommit<TCoverImageDraftPatch>({
    // Cover image patch values may intentionally be null to clear a slot. The
    // shared debounce hook only normalizes its pending container, so those
    // field-level nulls are still passed through to the image draft commit.
    onCommit: commitDraftImages,
  })

  useEffect(() => {
    if (!isPreviewingRef.current) {
      previewStateRef.current = committedState
      setDraftContextState((current) =>
        equals(current, committedState) ? current : committedState,
      )
    }
  }, [committedState])

  useEffect(() => {
    const committedSourceKey = getCommittedSourceKey(committedImages)
    if (committedSourceKeyRef.current === committedSourceKey) return

    committedSourceKeyRef.current = committedSourceKey
    clearPendingImageDraft()
    clearPreviewState()
  }, [
    clearPendingImageDraft,
    clearPreviewState,
    committedImages.primary,
    committedImages.secondary,
  ])

  useEffect(
    () => () => {
      if (previewFrameRef.current !== null) {
        window.cancelAnimationFrame(previewFrameRef.current)
      }

      if (clearFrameRef.current !== null) {
        window.cancelAnimationFrame(clearFrameRef.current)
      }

      emitCoverImagePreview(null)
    },
    [],
  )

  const activateImageDraft = useCallback(
    (which: TCoverImageWhich): void => {
      const currentState = previewStateRef.current
      const image = currentState.images[which]
      if (!image) return

      const nextState = {
        ...currentState,
        images: getRaisedImages(currentState.images, which),
        activeImageWhich: which,
      }

      setPreviewState(nextState)

      if (
        committedStateRef.current.activeImageWhich !== which ||
        !equals(committedStateRef.current.images, nextState.images)
      ) {
        committedStateRef.current = nextState
        imagesOnChangeRef.current(nextState.images, nextState.activeImageWhich)
      }
    },
    [setPreviewState],
  )

  const scheduleImagePatch = useCallback(
    (which: TCoverImageWhich, patch: TCoverImagePatch, options: TImagePatchOptions = {}): void => {
      const currentState = previewStateRef.current
      const image = currentState.images[which]
      if (!image) return

      const nextImage = mergeImagePatch(image, patch)
      const shouldRaise = options.raise !== false && currentState.activeImageWhich !== which
      if (equals(image, nextImage) && !shouldRaise) return

      const patchedImages = {
        ...currentState.images,
        [which]: nextImage,
      }
      const nextState = {
        ...currentState,
        images: shouldRaise ? getRaisedImages(patchedImages, which) : patchedImages,
        activeImageWhich: shouldRaise ? which : currentState.activeImageWhich,
      }
      const imagePatch = getChangedImagesPatch(committedStateRef.current.images, nextState.images)

      setPreviewState(nextState)

      if (hasImageDraftPatch(imagePatch)) {
        scheduleDraftCommit(imagePatch)
      }
    },
    [scheduleDraftCommit, setPreviewState],
  )

  const clearImageDraft = useCallback((): void => {
    clearPendingImageDraft()
    clearPreviewState()
  }, [clearPendingImageDraft, clearPreviewState])

  const flushImageDraft = useCallback((): void => {
    flushPendingImageDraft()
    clearPreviewState()
  }, [clearPreviewState, flushPendingImageDraft])

  const commitImagePatch = useCallback(
    (which: TCoverImageWhich, patch: TCoverImagePatch, options: TImagePatchOptions = {}): void => {
      clearImageDraft()
      imagePatchOnChangeRef.current(which, patch, options)
    },
    [clearImageDraft],
  )

  return useMemo<TCoverImageDraftContext>(
    () => ({
      images: draftContextState.images,
      activeImageWhich: draftContextState.activeImageWhich,
      activeImage: getActiveImage(draftContextState.images, draftContextState.activeImageWhich),
      activateImageDraft,
      scheduleImagePatch,
      commitImagePatch,
      flushImageDraft,
      clearImageDraft,
    }),
    [
      activateImageDraft,
      clearImageDraft,
      commitImagePatch,
      draftContextState,
      flushImageDraft,
      scheduleImagePatch,
    ],
  )
}
