import { isEmpty } from 'ramda'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FC, PointerEvent, ReactNode, WheelEvent } from 'react'

import usePageLock from '~/hooks/usePageLock'
import useUpdatePreviewCssVars from '~/hooks/useUpdatePreviewCssVars'
import { normalizeSignedAngle } from '~/lib/angle'
import { extractDominantColorFromImage } from '~/lib/imageColor/dominant'
import BgRenderer from '~/render/BgRenderer'

import { adaptCoverBgRenderSpec } from '../background'
import {
  COVER_IMAGE_CROP_ZOOM_RANGE,
  COVER_IMAGE_WHICH,
  IMAGE_EDIT_MODE,
  IMAGE_SIZE_RANGE,
} from '../constant'
import { getCoverPreviewCssVars } from '../coverImageCssVars'
import { subscribeCoverImagePreview } from '../coverImagePreview'
import { clampCoverImageCropZoom } from '../helper'
import { useImageDraftContext } from '../imageDraftContext'
import { getCoverRenderCanvas, type TImageResizeHandle } from '../salon/metric'
import type { TCoverImageConfig, TCoverImageWhich, TImageEditMode } from '../spec'
import useLogic from '../useLogic'
import CoverImageLayer from './CoverImageLayer'
import HeightResizer from './HeightResizer'
import ImageEditorFrame from './ImageEditorFrame'
import { deriveEditorInteraction, deriveMagnifierInteraction } from './interaction'
import MagnifierLayer from './MagnifierLayer'
import Placeholder from './Placeholder'
import useSalon from './salon'
import useCoverInteractions from './useCoverInteractions'

type TProps = {
  onDropFile: (file: File) => void
  onUpload: () => void
}

const HEIGHT_HANDLE_HOVER_START = 0.75

const Cover: FC<TProps> = ({ onDropFile, onUpload }) => {
  const { canvasHeightOnChange, imageLoadedOnChange, tuningSetting: setting } = useLogic()
  const { activeBackground } = setting
  const {
    activeImage,
    activeImageWhich,
    activateImageDraft,
    flushImageDraft,
    images,
    scheduleImagePatch,
  } = useImageDraftContext()
  const s = useSalon()
  const { lockPageOnce, unlockPageOnce } = usePageLock()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const cropWheelFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updatePreviewCssVars = useUpdatePreviewCssVars({
    targetRef: wrapperRef,
  })
  const [coverPointerInside, setCoverPointerInside] = useState(false)
  const [heightHandleHover, setHeightHandleHover] = useState(false)
  const [imageEditModes, setImageEditModes] = useState<Record<TCoverImageWhich, TImageEditMode>>({
    [COVER_IMAGE_WHICH.PRIMARY]: IMAGE_EDIT_MODE.MOVE,
    [COVER_IMAGE_WHICH.SECONDARY]: IMAGE_EDIT_MODE.MOVE,
  })
  const [hoveredRadiusHandle, setHoveredRadiusHandle] = useState<TImageResizeHandle | null>(null)
  const [hoveredMagnifierWhich, setHoveredMagnifierWhich] = useState<TCoverImageWhich | null>(null)

  const imageList = (
    [images.primary, images.secondary].filter(Boolean) as TCoverImageConfig[]
  ).sort((a, b) => a.zIndex - b.zIndex)
  const hasImage = imageList.length > 0
  const hasWallpaper = !isEmpty(activeBackground.source)
  const renderCanvas = getCoverRenderCanvas(setting)
  const canvasStyle: CSSProperties = {
    ...s.wrapperStyle,
    aspectRatio: `${setting.canvasWidth} / ${setting.canvasHeight}`,
  }
  const isFullFrame = imageList.some(
    (image) => image.size === IMAGE_SIZE_RANGE.MAX && normalizeSignedAngle(image.rotate) === 0,
  )
  const shouldShowTransparentGrid = !hasWallpaper && !isFullFrame
  const backgroundRenderSpec = adaptCoverBgRenderSpec(activeBackground)

  useEffect(() => {
    const unsubscribe = subscribeCoverImagePreview((previewState) => {
      if (!previewState) {
        updatePreviewCssVars(null)
        return
      }

      updatePreviewCssVars(getCoverPreviewCssVars(previewState))
    })

    return unsubscribe
  }, [updatePreviewCssVars])

  useEffect(
    () => () => {
      if (cropWheelFlushTimerRef.current) clearTimeout(cropWheelFlushTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    const shouldLockPage =
      coverPointerInside &&
      activeImage &&
      getImageEditMode(activeImage.which) === IMAGE_EDIT_MODE.REPOSITION

    if (shouldLockPage) {
      lockPageOnce()
      return unlockPageOnce
    }

    unlockPageOnce()
  }, [activeImage, coverPointerInside, imageEditModes, lockPageOnce, unlockPageOnce])

  const getImageEditMode = (which: TCoverImageWhich): TImageEditMode => imageEditModes[which]

  const imageEditModeOnChange = (which: TCoverImageWhich, mode: TImageEditMode): void => {
    setImageEditModes((current) =>
      current[which] === mode ? current : { ...current, [which]: mode },
    )
  }

  const {
    coverHeight,
    image: imageInteraction,
    magnifier: magnifierInteraction,
    mode: interactionMode,
    pointer,
    stateRef: interactionRef,
  } = useCoverInteractions({
    activateImageDraft,
    canvasHeight: setting.canvasHeight,
    canvasWidth: setting.canvasWidth,
    commitCoverHeight: canvasHeightOnChange,
    flushImageDraft,
    getImageEditMode,
    onRadiusFinish: () => setHoveredRadiusHandle(null),
    onRadiusStart: setHoveredRadiusHandle,
    renderCanvas,
    scheduleImagePatch,
    wrapperRef,
  })

  const handleCropWheel =
    (image: TCoverImageConfig) =>
    (event: WheelEvent<HTMLDivElement>): void => {
      if (getImageEditMode(image.which) !== IMAGE_EDIT_MODE.REPOSITION) return
      if (event.deltaY === 0) return

      event.preventDefault()
      event.stopPropagation()
      activateImageDraft(image.which)
      const direction = event.deltaY > 0 ? -1 : 1

      scheduleImagePatch(image.which, {
        crop: {
          ...image.crop,
          zoom: clampCoverImageCropZoom(
            image.crop.zoom + direction * COVER_IMAGE_CROP_ZOOM_RANGE.STEP,
          ),
        },
      })

      if (cropWheelFlushTimerRef.current) clearTimeout(cropWheelFlushTimerRef.current)
      cropWheelFlushTimerRef.current = setTimeout(() => {
        cropWheelFlushTimerRef.current = null
        flushImageDraft()
      }, 300)
    }

  const updateHeightHandleHover = (event: PointerEvent<HTMLElement>): void => {
    const state = interactionRef.current
    if (state && state.type !== 'cover-height') return

    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return

    const y = event.clientY - rect.top
    const nextHover = y >= rect.height * HEIGHT_HANDLE_HOVER_START

    setHeightHandleHover((current) => (current === nextHover ? current : nextHover))
  }

  const handleCoverPointerLeave = (): void => {
    setCoverPointerInside(false)
    setHeightHandleHover(false)
  }

  const handleImageLoad = (coverImage: TCoverImageConfig, image: HTMLImageElement): void => {
    imageLoadedOnChange(
      coverImage.which,
      coverImage.source,
      extractDominantColorFromImage(image)?.css ?? null,
    )
  }

  if (!hasImage) {
    return (
      <div ref={wrapperRef} className={s.wrapper} style={canvasStyle}>
        <Placeholder onDropFile={onDropFile} onUpload={onUpload} />
      </div>
    )
  }

  const activeRadiusHandle =
    interactionMode === 'radius' &&
    interactionRef.current?.type === 'radius' &&
    interactionRef.current.which === activeImageWhich
      ? interactionRef.current.handle
      : null
  const getShowMagnifierHandles = (image: TCoverImageConfig): boolean =>
    hoveredMagnifierWhich === image.which ||
    (interactionRef.current?.which === image.which &&
      (interactionMode === 'magnifier-move' ||
        interactionMode === 'magnifier-radius' ||
        interactionMode === 'magnifier-zoom'))

  const renderImageLayer = (image: TCoverImageConfig, isMagnifierClone = false): ReactNode => {
    const isInteracting =
      interactionMode !== 'idle' && interactionRef.current?.which === image.which

    return (
      <CoverImageLayer
        key={image.which}
        image={image}
        isInteracting={isInteracting}
        isMagnifierClone={isMagnifierClone}
        renderCanvas={renderCanvas}
        onImageLoad={(element) => handleImageLoad(image, element)}
        onPointerDown={isMagnifierClone ? undefined : imageInteraction.onPointerDown(image)}
        onPointerMove={isMagnifierClone ? undefined : pointer.onMove}
        onPointerUp={isMagnifierClone ? undefined : pointer.onUp}
        onWheel={isMagnifierClone ? undefined : handleCropWheel(image)}
      />
    )
  }

  const renderCoverContent = (isMagnifierClone = false): ReactNode => (
    <div className={s.contentLayer}>
      {hasWallpaper && !isMagnifierClone && (
        <BgRenderer
          className={s.backgroundLayer}
          renderSpec={backgroundRenderSpec}
          positioned={false}
          textureScale={0.82}
        />
      )}
      {shouldShowTransparentGrid && (
        <div className={s.backgroundLayer} style={s.transparentGridStyle} />
      )}
      {imageList.map((image) => renderImageLayer(image, isMagnifierClone))}
    </div>
  )

  const renderMagnifier = (image: TCoverImageConfig): ReactNode => {
    if (!image.magnifier.enabled) return null
    const interaction = deriveMagnifierInteraction(
      interactionMode,
      interactionRef.current,
      image.which,
    )

    return (
      <MagnifierLayer
        key={image.which}
        cloneContent={renderCoverContent(true)}
        image={image}
        interaction={interaction}
        onHoverChange={(hovered) => setHoveredMagnifierWhich(hovered ? image.which : null)}
        onMovePointerDown={magnifierInteraction.onMovePointerDown(image)}
        onPointerMove={pointer.onMove}
        onPointerUp={pointer.onUp}
        onRadiusPointerDown={magnifierInteraction.onRadiusPointerDown(image)}
        onZoomPointerDown={magnifierInteraction.onZoomPointerDown(image)}
        renderCanvas={renderCanvas}
        showHandles={getShowMagnifierHandles(image)}
      />
    )
  }

  return (
    <div
      ref={wrapperRef}
      className={s.wrapper}
      style={canvasStyle}
      onPointerEnter={() => setCoverPointerInside(true)}
      onPointerMove={updateHeightHandleHover}
      onPointerLeave={handleCoverPointerLeave}
    >
      {hasImage && (
        <>
          <div className={s.editorClipLayer}>
            {renderCoverContent()}
            {imageList.map((image) => renderMagnifier(image))}
            {activeImage && (
              <ImageEditorFrame
                activeRadiusHandle={activeRadiusHandle}
                editMode={getImageEditMode(activeImage.which)}
                hidden={getShowMagnifierHandles(activeImage)}
                hoveredRadiusHandle={hoveredRadiusHandle}
                image={activeImage}
                interaction={deriveEditorInteraction(
                  interactionMode,
                  interactionRef.current,
                  activeImage.which,
                )}
                onEditModeChange={(mode) => imageEditModeOnChange(activeImage.which, mode)}
                onPointerDown={imageInteraction.onPointerDown(activeImage)}
                onPointerMove={pointer.onMove}
                onPointerUp={pointer.onUp}
                onRadiusPointerDown={(handle, direction) =>
                  imageInteraction.onRadiusPointerDown(activeImage, handle, direction)
                }
                onResizePointerDown={(handle) =>
                  imageInteraction.onResizePointerDown(activeImage, handle)
                }
                onRadiusHoverChange={setHoveredRadiusHandle}
                onWheel={handleCropWheel(activeImage)}
                renderCanvas={renderCanvas}
              />
            )}
          </div>
          <HeightResizer
            onPointerDown={coverHeight.onPointerDown}
            onPointerMove={pointer.onMove}
            onPointerUp={pointer.onUp}
            onPointerCancel={pointer.onUp}
            visible={heightHandleHover || interactionMode === 'cover-height'}
          />
        </>
      )}
    </div>
  )
}

export default Cover
