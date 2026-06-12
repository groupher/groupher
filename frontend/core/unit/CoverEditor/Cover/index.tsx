import { isEmpty } from 'ramda'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FC, PointerEvent, ReactNode } from 'react'

import useUpdatePreviewCssVars from '~/hooks/useUpdatePreviewCssVars'
import { normalizeSignedAngle } from '~/lib/angle'
import { extractDominantColorFromImage } from '~/lib/imageColor/dominant'
import BgRenderer from '~/widgets/BgRenderer'

import { adaptCoverBgRenderSpec } from '../background'
import {
  GLASS_FRAME,
  IMAGE_CONTAINER_SIZE,
  IMAGE_SIZE_RANGE,
  MAGNIFIER_RENDER_SIZE,
  MAGNIFIER_ZOOM_RANGE,
} from '../constant'
import {
  getCoverImageVarValue,
  getCoverPreviewCssVars,
  getFrameBorderRadiusValue,
  getFramePaddingValue,
  getMagnifierRenderSize,
} from '../coverImageCssVars'
import { subscribeCoverImagePreview } from '../coverImagePreview'
import { getImageShadow, getMagnifierAppearanceStyle } from '../helper'
import { useImageDraftContext } from '../imageDraftContext'
import {
  getBorderRadiusFromCanvasPoint,
  getCanvasPointFromClient,
  getImageCanvasCenter,
  getImagePositionFromCanvasPoint,
  getImageResizeFromCanvasPoint,
  type TImageResizeHandle,
} from '../salon/metric'
import type { TCoverImageConfig, TCoverImageWhich, TCoverPoint, TImageSize } from '../spec'
import useLogic from '../useLogic'
import BorderRender from './BorderRender'
import Placeholder from './Placeholder'
import useSalon from './salon'

type TProps = {
  onDropFile: (file: File) => void
  onUpload: () => void
}

type TInteractionMode =
  | 'idle'
  | 'magnifier-move'
  | 'magnifier-radius'
  | 'magnifier-zoom'
  | 'move'
  | 'radius'
  | 'resize'

type TInteractionState =
  | {
      pointerId: number
      rotate: number
      startCenter: TCoverPoint
      startPoint: TCoverPoint
      startSize: TImageSize
      type: 'move'
      which: TCoverImageWhich
    }
  | {
      handle: TImageResizeHandle
      pointerId: number
      rotate: number
      startCenter: TCoverPoint
      startSize: TImageSize
      type: 'resize'
      which: TCoverImageWhich
    }
  | {
      handle: TImageResizeHandle
      localDirection: TCoverPoint
      pointerId: number
      rotate: number
      startCenter: TCoverPoint
      startSize: TImageSize
      type: 'radius'
      which: TCoverImageWhich
    }
  | {
      pointerId: number
      startCenter: TCoverPoint
      startPoint: TCoverPoint
      startRadius: number
      type: 'magnifier-move'
      which: TCoverImageWhich
    }
  | {
      pointerId: number
      startCenter: TCoverPoint
      startRadius: number
      type: 'magnifier-radius'
      which: TCoverImageWhich
    }
  | {
      pointerId: number
      startPoint: TCoverPoint
      startZoom: number
      type: 'magnifier-zoom'
      which: TCoverImageWhich
    }

type TResizeHandleConfig = {
  classNameKey:
    | 'resizeHandleTopLeft'
    | 'resizeHandleTopRight'
    | 'resizeHandleBottomLeft'
    | 'resizeHandleBottomRight'
  cursorClassNameKey: 'resizeCursorNesw' | 'resizeCursorNwse'
  handle: TImageResizeHandle
  label: string
}

const RESIZE_HANDLES: TResizeHandleConfig[] = [
  {
    handle: 'top-left',
    classNameKey: 'resizeHandleTopLeft',
    cursorClassNameKey: 'resizeCursorNwse',
    label: 'Resize from top left',
  },
  {
    handle: 'top-right',
    classNameKey: 'resizeHandleTopRight',
    cursorClassNameKey: 'resizeCursorNesw',
    label: 'Resize from top right',
  },
  {
    handle: 'bottom-left',
    classNameKey: 'resizeHandleBottomLeft',
    cursorClassNameKey: 'resizeCursorNesw',
    label: 'Resize from bottom left',
  },
  {
    handle: 'bottom-right',
    classNameKey: 'resizeHandleBottomRight',
    cursorClassNameKey: 'resizeCursorNwse',
    label: 'Resize from bottom right',
  },
]

const RADIUS_HANDLE_VISUAL: Record<
  TImageResizeHandle,
  { axis: { x: 1; y: -1 | 1 }; guideTransform: string }
> = {
  'top-left': {
    axis: { x: 1, y: -1 },
    guideTransform: 'translate(-50%, -50%) rotate(-45deg)',
  },
  'top-right': {
    axis: { x: 1, y: 1 },
    guideTransform: 'translate(-50%, -50%) rotate(45deg)',
  },
  'bottom-left': {
    axis: { x: 1, y: 1 },
    guideTransform: 'translate(-50%, -50%) rotate(45deg)',
  },
  'bottom-right': {
    axis: { x: 1, y: -1 },
    guideTransform: 'translate(-50%, -50%) rotate(-45deg)',
  },
}

const getRadiusHandleLength = (borderRadius: number): number =>
  Math.min(64, Math.max(24, 24 + borderRadius))

const getRadiusDotTransform = (axis: { x: 1; y: -1 | 1 }, offset: number): string =>
  `translate(calc(-50% + ${(axis.x * offset) / Math.SQRT2}px), calc(-50% + ${
    (axis.y * offset) / Math.SQRT2
  }px))`

const CANVAS_WIDTH = Number.parseFloat(IMAGE_CONTAINER_SIZE.WIDTH)
const CANVAS_HEIGHT = Number.parseFloat(IMAGE_CONTAINER_SIZE.HEIGHT)

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const getMagnifierRadiusFromCanvasPoint = (
  point: TCoverPoint,
  center: TCoverPoint,
  startRadius: number,
): number => {
  const centerPoint = {
    x: center.x * CANVAS_WIDTH,
    y: center.y * CANVAS_HEIGHT,
  }
  const distance = Math.sqrt((point.x - centerPoint.x) ** 2 + (point.y - centerPoint.y) ** 2)
  const minRadius = MAGNIFIER_RENDER_SIZE.MIN / 2
  const maxRadius = MAGNIFIER_RENDER_SIZE.MAX / 2

  if (distance <= 0) return startRadius

  return clamp01((distance - minRadius) / (maxRadius - minRadius))
}

const clampMagnifierZoom = (zoom: number): number =>
  Math.min(MAGNIFIER_ZOOM_RANGE.MAX, Math.max(MAGNIFIER_ZOOM_RANGE.MIN, Number(zoom.toFixed(1))))

const Cover: FC<TProps> = ({ onDropFile, onUpload }) => {
  const { imageLoadedOnChange, tuningSetting: setting } = useLogic()
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
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const updatePreviewCssVars = useUpdatePreviewCssVars({ targetRef: wrapperRef })
  const interactionRef = useRef<TInteractionState | null>(null)
  const [interactionMode, setInteractionMode] = useState<TInteractionMode>('idle')
  const [hoveredRadiusHandle, setHoveredRadiusHandle] = useState<TImageResizeHandle | null>(null)
  const [hoveredMagnifierWhich, setHoveredMagnifierWhich] = useState<TCoverImageWhich | null>(null)

  const imageList = (
    [images.primary, images.secondary].filter(Boolean) as TCoverImageConfig[]
  ).sort((a, b) => a.zIndex - b.zIndex)
  const hasImage = imageList.length > 0
  const hasWallpaper = !isEmpty(activeBackground.source)
  const isFullFrame = imageList.some(
    (image) => image.size === IMAGE_SIZE_RANGE.MAX && normalizeSignedAngle(image.rotate) === 0,
  )
  const shouldShowTransparentGrid = !hasWallpaper && !isFullFrame
  const backgroundRenderSpec = adaptCoverBgRenderSpec(activeBackground)

  const getImageRenderState = (image: TCoverImageConfig) => {
    const imageFrameSize = s.getResponsiveImageSize(image.size)
    const rotate = normalizeSignedAngle(image.rotate)
    const imagePlacement = s.getImagePlacement(image.position, image.size, rotate)
    const borderRadiusValue = `${image.borderRadius}px`
    const frameBorderRadiusValue = getFrameBorderRadiusValue(image)
    const framePadding = image.glassBorder.enabled
      ? { x: GLASS_FRAME.PADDING_X, y: GLASS_FRAME.PADDING_Y }
      : undefined
    const imageVar = (key: string, fallback: string | number): string =>
      getCoverImageVarValue(image.which, key, fallback)
    const framePaddingValue = getFramePaddingValue(image)
    const imageFrameStyle: CSSProperties = {
      borderRadius: imageVar('frame-radius', frameBorderRadiusValue),
      width: imageVar('width', imageFrameSize.width),
      height: imageVar('height', imageFrameSize.height),
      left: imageVar('left', imagePlacement.left),
      top: imageVar('top', imagePlacement.top),
      padding: imageVar('padding', framePaddingValue),
      boxSizing: 'content-box',
      backgroundColor: image.glassBorder.enabled ? 'rgba(255, 255, 255, 0.2)' : undefined,
      backdropFilter: image.glassBorder.enabled ? 'blur(5px)' : undefined,
      WebkitBackdropFilter: image.glassBorder.enabled ? 'blur(5px)' : undefined,
      boxShadow: imageVar('shadow', getImageShadow(image.shadow) ?? 'none'),
      transform: `translate(-50%, -50%) rotate(${imageVar('rotate', `${rotate}deg`)})`,
      zIndex: imageVar('z-index', image.zIndex),
    }
    const magnifierImageFrameStyle: CSSProperties = {
      ...imageFrameStyle,
      backgroundColor: image.glassBorder.enabled ? 'rgba(255, 255, 255, 0.16)' : undefined,
      backdropFilter: undefined,
      WebkitBackdropFilter: undefined,
    }
    const editorFrameStyle: CSSProperties = {
      borderRadius: imageVar('frame-radius', frameBorderRadiusValue),
      width: imageVar('width', imageFrameSize.width),
      height: imageVar('height', imageFrameSize.height),
      left: imageVar('left', imagePlacement.left),
      top: imageVar('top', imagePlacement.top),
      padding: imageVar('padding', framePaddingValue),
      boxSizing: 'content-box',
      transform: `translate(-50%, -50%) rotate(${imageVar('rotate', `${rotate}deg`)})`,
      zIndex: imageVar('editor-z-index', image.zIndex + 1),
    }
    const cropViewportStyle: CSSProperties = {
      boxSizing: 'border-box',
      borderRadius: imageVar('crop-radius', borderRadiusValue),
    }

    return {
      borderRadiusValue,
      cropViewportStyle,
      editorFrameStyle,
      frameBorderRadiusValue,
      framePadding,
      imageFrameStyle,
      magnifierImageFrameStyle,
    }
  }

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

  const getCanvasPoint = (event: PointerEvent<HTMLElement>): TCoverPoint | null => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return null

    return getCanvasPointFromClient(event.clientX, event.clientY, rect)
  }

  const isPrimaryPointer = (event: PointerEvent<HTMLElement>): boolean =>
    event.isPrimary && (event.pointerType !== 'mouse' || event.button === 0)

  const finishInteraction = (event: PointerEvent<HTMLElement>): void => {
    const state = interactionRef.current

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    interactionRef.current = null
    if (state?.type === 'radius') setHoveredRadiusHandle(null)
    setInteractionMode('idle')
    flushImageDraft()
  }

  const updateMoveInteraction = (
    state: Extract<TInteractionState, { type: 'move' }>,
    point: TCoverPoint,
  ): void => {
    const nextCenter = {
      x: state.startCenter.x + point.x - state.startPoint.x,
      y: state.startCenter.y + point.y - state.startPoint.y,
    }

    scheduleImagePatch(state.which, {
      position: getImagePositionFromCanvasPoint(nextCenter, state.startSize, state.rotate),
    })
  }

  const updateResizeInteraction = (
    state: Extract<TInteractionState, { type: 'resize' }>,
    point: TCoverPoint,
  ): void => {
    const next = getImageResizeFromCanvasPoint({
      handle: state.handle,
      point,
      rotate: state.rotate,
      startCenter: state.startCenter,
      startSize: state.startSize,
    })

    scheduleImagePatch(state.which, {
      size: next.size,
      position: getImagePositionFromCanvasPoint(next.center, next.size, state.rotate),
    })
  }

  const updateRadiusInteraction = (
    state: Extract<TInteractionState, { type: 'radius' }>,
    point: TCoverPoint,
  ): void => {
    scheduleImagePatch(state.which, {
      borderRadius: getBorderRadiusFromCanvasPoint({
        center: state.startCenter,
        handle: state.handle,
        localDirection: state.localDirection,
        point,
        rotate: state.rotate,
        size: state.startSize,
      }),
    })
  }

  const updateMagnifierMoveInteraction = (
    state: Extract<TInteractionState, { type: 'magnifier-move' }>,
    point: TCoverPoint,
  ): void => {
    scheduleImagePatch(state.which, {
      magnifier: {
        center: {
          x: clamp01(state.startCenter.x + (point.x - state.startPoint.x) / CANVAS_WIDTH),
          y: clamp01(state.startCenter.y + (point.y - state.startPoint.y) / CANVAS_HEIGHT),
        },
        radius: state.startRadius,
        enabled: true,
      },
    })
  }

  const updateMagnifierRadiusInteraction = (
    state: Extract<TInteractionState, { type: 'magnifier-radius' }>,
    point: TCoverPoint,
  ): void => {
    scheduleImagePatch(state.which, {
      magnifier: {
        center: state.startCenter,
        radius: getMagnifierRadiusFromCanvasPoint(point, state.startCenter, state.startRadius),
        enabled: true,
      },
    })
  }

  const updateMagnifierZoomInteraction = (
    state: Extract<TInteractionState, { type: 'magnifier-zoom' }>,
    point: TCoverPoint,
  ): void => {
    const dragDistance = (point.x - state.startPoint.x + point.y - state.startPoint.y) / Math.SQRT2
    const zoomRange = MAGNIFIER_ZOOM_RANGE.MAX - MAGNIFIER_ZOOM_RANGE.MIN
    const nextZoom = state.startZoom + (dragDistance / 120) * zoomRange

    scheduleImagePatch(state.which, { magnifier: { zoom: clampMagnifierZoom(nextZoom) } })
  }

  const handleMovePointerDown =
    (image: TCoverImageConfig) =>
    (event: PointerEvent<HTMLDivElement>): void => {
      if (!isPrimaryPointer(event)) return

      const startPoint = getCanvasPoint(event)
      if (!startPoint) return

      event.preventDefault()
      activateImageDraft(image.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      const rotate = normalizeSignedAngle(image.rotate)
      interactionRef.current = {
        pointerId: event.pointerId,
        rotate,
        startCenter: getImageCanvasCenter(image.position, image.size, rotate),
        startPoint,
        startSize: image.size,
        type: 'move',
        which: image.which,
      }
      setInteractionMode('move')
    }

  const handleResizePointerDown =
    (image: TCoverImageConfig, handle: TImageResizeHandle) =>
    (event: PointerEvent<HTMLElement>): void => {
      if (!isPrimaryPointer(event)) return

      event.preventDefault()
      event.stopPropagation()
      activateImageDraft(image.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      const rotate = normalizeSignedAngle(image.rotate)
      interactionRef.current = {
        handle,
        pointerId: event.pointerId,
        rotate,
        startCenter: getImageCanvasCenter(image.position, image.size, rotate),
        startSize: image.size,
        type: 'resize',
        which: image.which,
      }
      setInteractionMode('resize')
    }

  const handleRadiusPointerDown =
    (image: TCoverImageConfig, handle: TImageResizeHandle, localDirection: TCoverPoint) =>
    (event: PointerEvent<HTMLButtonElement>): void => {
      if (!isPrimaryPointer(event)) return

      const point = getCanvasPoint(event)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()
      activateImageDraft(image.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      const rotate = normalizeSignedAngle(image.rotate)

      const nextState: Extract<TInteractionState, { type: 'radius' }> = {
        handle,
        localDirection,
        pointerId: event.pointerId,
        rotate,
        startCenter: getImageCanvasCenter(image.position, image.size, rotate),
        startSize: image.size,
        type: 'radius',
        which: image.which,
      }

      interactionRef.current = nextState
      setHoveredRadiusHandle(handle)
      setInteractionMode('radius')
      updateRadiusInteraction(nextState, point)
    }

  const handleMagnifierMovePointerDown =
    (image: TCoverImageConfig) =>
    (event: PointerEvent<HTMLDivElement>): void => {
      if (!isPrimaryPointer(event)) return

      const point = getCanvasPoint(event)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()
      activateImageDraft(image.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      interactionRef.current = {
        pointerId: event.pointerId,
        startCenter: image.magnifier.center,
        startPoint: point,
        startRadius: image.magnifier.radius,
        type: 'magnifier-move',
        which: image.which,
      }
      setInteractionMode('magnifier-move')
    }

  const handleMagnifierRadiusPointerDown =
    (image: TCoverImageConfig) =>
    (event: PointerEvent<HTMLButtonElement>): void => {
      if (!isPrimaryPointer(event)) return

      const point = getCanvasPoint(event)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()
      activateImageDraft(image.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      const nextState: Extract<TInteractionState, { type: 'magnifier-radius' }> = {
        pointerId: event.pointerId,
        startCenter: image.magnifier.center,
        startRadius: image.magnifier.radius,
        type: 'magnifier-radius',
        which: image.which,
      }

      interactionRef.current = nextState
      setInteractionMode('magnifier-radius')
      updateMagnifierRadiusInteraction(nextState, point)
    }

  const handleMagnifierZoomPointerDown =
    (image: TCoverImageConfig) =>
    (event: PointerEvent<HTMLButtonElement>): void => {
      if (!isPrimaryPointer(event)) return

      const point = getCanvasPoint(event)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()
      activateImageDraft(image.which)
      event.currentTarget.setPointerCapture(event.pointerId)
      interactionRef.current = {
        pointerId: event.pointerId,
        startPoint: point,
        startZoom: image.magnifier.zoom,
        type: 'magnifier-zoom',
        which: image.which,
      }
      setInteractionMode('magnifier-zoom')
    }

  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    const state = interactionRef.current
    if (!state || state.pointerId !== event.pointerId) return
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return

    const point = getCanvasPoint(event)
    if (!point) return

    event.preventDefault()

    if (state.type === 'move') updateMoveInteraction(state, point)
    else if (state.type === 'resize') updateResizeInteraction(state, point)
    else if (state.type === 'radius') updateRadiusInteraction(state, point)
    else if (state.type === 'magnifier-move') updateMagnifierMoveInteraction(state, point)
    else if (state.type === 'magnifier-radius') updateMagnifierRadiusInteraction(state, point)
    else updateMagnifierZoomInteraction(state, point)
  }

  const handlePointerUp = (event: PointerEvent<HTMLElement>): void => {
    const state = interactionRef.current
    if (!state || state.pointerId !== event.pointerId) return

    handlePointerMove(event)
    finishInteraction(event)
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
      <div ref={wrapperRef} className={s.wrapper} style={s.wrapperStyle}>
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
  const radiusHandleLength = getRadiusHandleLength(activeImage?.borderRadius ?? 0)
  const radiusDotOffset = radiusHandleLength / 2

  const getShowMagnifierHandles = (image: TCoverImageConfig): boolean =>
    hoveredMagnifierWhich === image.which ||
    (interactionRef.current?.which === image.which &&
      (interactionMode === 'magnifier-move' ||
        interactionMode === 'magnifier-radius' ||
        interactionMode === 'magnifier-zoom'))

  const renderImageLayer = (image: TCoverImageConfig, isMagnifierClone = false): ReactNode => {
    const {
      cropViewportStyle,
      frameBorderRadiusValue,
      framePadding,
      imageFrameStyle,
      magnifierImageFrameStyle,
    } = getImageRenderState(image)
    const isInteracting =
      interactionMode !== 'idle' && interactionRef.current?.which === image.which

    return (
      <div
        key={image.which}
        className={s.cn(s.imageFrame, isInteracting && s.imageFrameActive)}
        style={isMagnifierClone ? magnifierImageFrameStyle : imageFrameStyle}
        onPointerDown={isMagnifierClone ? undefined : handleMovePointerDown(image)}
        onPointerMove={isMagnifierClone ? undefined : handlePointerMove}
        onPointerUp={isMagnifierClone ? undefined : handlePointerUp}
        onPointerCancel={isMagnifierClone ? undefined : handlePointerUp}
      >
        <div
          className={s.cn(s.cropViewport, isInteracting && s.cropViewportActive)}
          style={cropViewportStyle}
        >
          <img
            className={s.cn(s.image, isInteracting && s.imageActive)}
            src={image.source}
            alt=''
            draggable={false}
            onLoad={
              isMagnifierClone ? undefined : (event) => handleImageLoad(image, event.currentTarget)
            }
          />
        </div>
        <BorderRender
          className={s.borderHighlight}
          borderRadius={frameBorderRadiusValue}
          borderHighlight={image.borderHighlight}
          framePadding={framePadding}
          size={image.size}
        />
      </div>
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

    const magnifierRenderSize = getMagnifierRenderSize(image.magnifier.radius)
    const magnifierSizePercent = (magnifierRenderSize / CANVAS_WIDTH) * 100
    const magnifierCanvasLeft = image.magnifier.center.x * CANVAS_WIDTH - magnifierRenderSize / 2
    const magnifierCanvasTop = image.magnifier.center.y * CANVAS_HEIGHT - magnifierRenderSize / 2
    const imageVar = (key: string, fallback: string | number): string =>
      getCoverImageVarValue(image.which, key, fallback)
    const magnifierCloneStyle: CSSProperties = {
      width: imageVar('magnifier-clone-width', `${(CANVAS_WIDTH / magnifierRenderSize) * 100}%`),
      height: imageVar('magnifier-clone-height', `${(CANVAS_HEIGHT / magnifierRenderSize) * 100}%`),
      left: imageVar(
        'magnifier-clone-left',
        `${(-magnifierCanvasLeft / magnifierRenderSize) * 100}%`,
      ),
      top: imageVar('magnifier-clone-top', `${(-magnifierCanvasTop / magnifierRenderSize) * 100}%`),
      transform: imageVar('magnifier-clone-transform', `scale(${image.magnifier.zoom})`),
      transformOrigin: imageVar(
        'magnifier-clone-origin',
        `${image.magnifier.center.x * 100}% ${image.magnifier.center.y * 100}%`,
      ),
    }
    const magnifierStyle: CSSProperties = {
      width: imageVar('magnifier-width', `${magnifierSizePercent}%`),
      left: imageVar('magnifier-left', `${image.magnifier.center.x * 100}%`),
      top: imageVar('magnifier-top', `${image.magnifier.center.y * 100}%`),
      zIndex: imageVar('magnifier-z-index', image.zIndex + 2),
      ...getMagnifierAppearanceStyle(image.magnifier),
    }
    const showMagnifierHandles = getShowMagnifierHandles(image)

    return (
      <div
        key={image.which}
        className={s.cn(
          s.magnifier,
          interactionMode === 'magnifier-move' &&
            interactionRef.current?.which === image.which &&
            s.magnifierMoving,
          interactionMode === 'magnifier-radius' &&
            interactionRef.current?.which === image.which &&
            s.magnifierResizing,
          interactionMode === 'magnifier-zoom' &&
            interactionRef.current?.which === image.which &&
            s.magnifierZooming,
        )}
        style={magnifierStyle}
        aria-label='Move magnifier'
        onPointerDown={handleMagnifierMovePointerDown(image)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerEnter={() => setHoveredMagnifierWhich(image.which)}
        onPointerLeave={() => setHoveredMagnifierWhich(null)}
      >
        <div className={s.magnifierViewport}>
          <div className={s.magnifierClone} style={magnifierCloneStyle}>
            {renderCoverContent(true)}
          </div>
        </div>
        {showMagnifierHandles && (
          <>
            <button
              type='button'
              className={s.magnifierRadiusHandle}
              aria-label='Adjust magnifier size'
              onPointerDown={handleMagnifierRadiusPointerDown(image)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            <button
              type='button'
              className={s.magnifierZoomHandle}
              aria-label='Adjust magnifier zoom'
              onPointerDown={handleMagnifierZoomPointerDown(image)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </>
        )}
      </div>
    )
  }

  const renderEditorFrame = (image: TCoverImageConfig): ReactNode => {
    const { editorFrameStyle, frameBorderRadiusValue } = getImageRenderState(image)
    const showMagnifierHandles = getShowMagnifierHandles(image)

    return (
      <div
        className={s.cn(
          s.editorFrame,
          showMagnifierHandles && s.editorFrameHidden,
          interactionMode !== 'idle' &&
            interactionRef.current?.which === image.which &&
            s.editorFrameActive,
          interactionMode === 'idle' && s.editorFrameMove,
          interactionMode === 'move' &&
            interactionRef.current?.which === image.which &&
            s.editorFrameMoving,
          interactionMode === 'resize' &&
            interactionRef.current?.which === image.which &&
            s.editorFrameResizing,
        )}
        style={editorFrameStyle}
        aria-label='Move image'
        onPointerDown={handleMovePointerDown(image)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className={s.cn(s.editorBorder, s.editorBorderTone)}
          style={{ borderRadius: frameBorderRadiusValue }}
        />
        {RESIZE_HANDLES.map(({ classNameKey, cursorClassNameKey, handle, label }) => {
          const radiusHandleVisible =
            hoveredRadiusHandle === handle || activeRadiusHandle === handle
          const radiusVisual = RADIUS_HANDLE_VISUAL[handle]
          const guideStyle: CSSProperties = {
            transform: radiusVisual.guideTransform,
            width: `${radiusHandleLength}px`,
          }
          const bridgeStyle: CSSProperties = {
            height: `${radiusHandleLength + 16}px`,
            transform: radiusVisual.guideTransform,
            width: `${radiusHandleLength + 16}px`,
          }
          const radiusDots = [
            {
              direction: {
                x: -radiusVisual.axis.x,
                y: -radiusVisual.axis.y,
              },
              key: 'start',
              transform: getRadiusDotTransform(radiusVisual.axis, -radiusDotOffset),
            },
            {
              direction: {
                x: radiusVisual.axis.x,
                y: radiusVisual.axis.y,
              },
              key: 'end',
              transform: getRadiusDotTransform(radiusVisual.axis, radiusDotOffset),
            },
          ]

          return (
            <div
              key={handle}
              className={s.cn(s.resizeHandleGroup, s[classNameKey])}
              onPointerDown={handleResizePointerDown(image, handle)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerEnter={() => setHoveredRadiusHandle(handle)}
              onPointerLeave={() => setHoveredRadiusHandle(null)}
            >
              <button
                type='button'
                className={s.cn(s.resizeHandle, s[cursorClassNameKey])}
                aria-label={label}
              />
              {radiusHandleVisible && (
                <>
                  <span className={s.radiusBridge} style={bridgeStyle} />
                  <span className={s.cn(s.radiusGuide, s.radiusGuideTone)} style={guideStyle} />
                  {radiusDots.map(({ direction, key, transform }) => (
                    <button
                      key={key}
                      type='button'
                      className={s.radiusDot}
                      style={{ transform }}
                      aria-label={`Adjust corner radius from ${handle}`}
                      onPointerDown={handleRadiusPointerDown(image, handle, direction)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                    />
                  ))}
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className={s.wrapper} style={s.wrapperStyle}>
      {hasImage && (
        <>
          {renderCoverContent()}
          {imageList.map((image) => renderMagnifier(image))}
          {activeImage && renderEditorFrame(activeImage)}
        </>
      )}
    </div>
  )
}

export default Cover
