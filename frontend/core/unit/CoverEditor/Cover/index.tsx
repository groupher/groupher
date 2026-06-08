import { isEmpty } from 'ramda'
import { useRef, useState } from 'react'
import type { CSSProperties, FC, PointerEvent, ReactNode } from 'react'

import { parseCoreBgWallpaper } from '~/lib/coreBg/parse'
import { extractDominantColorFromImage } from '~/lib/imageColor/dominant'

import {
  GLASS_FRAME,
  IMAGE_CONTAINER_SIZE,
  IMAGE_SIZE_RANGE,
  MAGNIFIER_RENDER_SIZE,
  MAGNIFIER_ZOOM_RANGE,
} from '../constant'
import { getImageShadow, getMagnifierAppearanceStyle } from '../helper'
import {
  getBorderRadiusFromCanvasPoint,
  getCanvasPointFromClient,
  getImageCanvasCenter,
  getImagePositionFromCanvasPoint,
  getImageResizeFromCanvasPoint,
  type TImageResizeHandle,
} from '../salon/metric'
import type { TCoverPoint, TImageSize } from '../spec'
import useLogic from '../useLogic'
import BorderRender from './BorderRender'
import Placeholder from './Placeholder'
import useSalon from './salon'

type TProps = {
  imageUrl: string
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
    }
  | {
      handle: TImageResizeHandle
      pointerId: number
      rotate: number
      startCenter: TCoverPoint
      startSize: TImageSize
      type: 'resize'
    }
  | {
      handle: TImageResizeHandle
      localDirection: TCoverPoint
      pointerId: number
      rotate: number
      startCenter: TCoverPoint
      startSize: TImageSize
      type: 'radius'
    }
  | {
      pointerId: number
      startCenter: TCoverPoint
      startPoint: TCoverPoint
      type: 'magnifier-move'
    }
  | {
      pointerId: number
      startCenter: TCoverPoint
      startRadius: number
      type: 'magnifier-radius'
    }
  | {
      pointerId: number
      startPoint: TCoverPoint
      startZoom: number
      type: 'magnifier-zoom'
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

const getMagnifierRenderSize = (radius: number): number =>
  MAGNIFIER_RENDER_SIZE.MIN +
  (MAGNIFIER_RENDER_SIZE.MAX - MAGNIFIER_RENDER_SIZE.MIN) * clamp01(radius)

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

const Cover: FC<TProps> = ({ imageUrl, onDropFile, onUpload }) => {
  const {
    borderRadiusOnChange,
    imageLoadedOnChange,
    magnifierRadiationOnChange,
    magnifierZoomOnChange,
    positionOnChange,
    sizeOnChange,
    tuningSetting: setting,
  } = useLogic()
  const {
    size,
    shadow,
    hasGlassBorder,
    borderRadius,
    borderHighlight,
    hasMagnifier,
    magnifierCenter,
    magnifierRadius,
    magnifierZoom,
    magnifierAppearance,
    wallpaper,
    wallpapers,
    rotate,
    position,
  } = setting
  const s = useSalon()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const interactionRef = useRef<TInteractionState | null>(null)
  const [interactionMode, setInteractionMode] = useState<TInteractionMode>('idle')
  const [hoveredRadiusHandle, setHoveredRadiusHandle] = useState<TImageResizeHandle | null>(null)
  const [magnifierHovered, setMagnifierHovered] = useState(false)

  const hasImage = !isEmpty(imageUrl)
  const imageFrameSize = s.getResponsiveImageSize(size)
  const imagePlacement = s.getImagePlacement(position, size, rotate)
  const hasWallpaper = !isEmpty(wallpaper)
  const isFullFrame = size === IMAGE_SIZE_RANGE.MAX && rotate === 0
  const shouldShowTransparentGrid = !hasWallpaper && !isFullFrame
  const borderRadiusValue = `${borderRadius}px`
  const frameBorderRadiusValue = hasGlassBorder
    ? `${borderRadius + GLASS_FRAME.PADDING_Y}px`
    : borderRadiusValue
  const framePadding = hasGlassBorder
    ? { x: GLASS_FRAME.PADDING_X, y: GLASS_FRAME.PADDING_Y }
    : undefined
  const wrapperBackgroundStyle: CSSProperties = hasWallpaper
    ? { backgroundImage: parseCoreBgWallpaper(wallpapers, wallpaper).background }
    : shouldShowTransparentGrid
      ? s.transparentGridStyle
      : {}

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
  }

  const updateMoveInteraction = (
    state: Extract<TInteractionState, { type: 'move' }>,
    point: TCoverPoint,
  ): void => {
    const nextCenter = {
      x: state.startCenter.x + point.x - state.startPoint.x,
      y: state.startCenter.y + point.y - state.startPoint.y,
    }

    positionOnChange(getImagePositionFromCanvasPoint(nextCenter, state.startSize, state.rotate))
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

    sizeOnChange(next.size)
    positionOnChange(getImagePositionFromCanvasPoint(next.center, next.size, state.rotate))
  }

  const updateRadiusInteraction = (
    state: Extract<TInteractionState, { type: 'radius' }>,
    point: TCoverPoint,
  ): void => {
    borderRadiusOnChange(
      getBorderRadiusFromCanvasPoint({
        center: state.startCenter,
        handle: state.handle,
        localDirection: state.localDirection,
        point,
        rotate: state.rotate,
        size: state.startSize,
      }),
    )
  }

  const updateMagnifierMoveInteraction = (
    state: Extract<TInteractionState, { type: 'magnifier-move' }>,
    point: TCoverPoint,
  ): void => {
    magnifierRadiationOnChange(
      {
        x: clamp01(state.startCenter.x + (point.x - state.startPoint.x) / CANVAS_WIDTH),
        y: clamp01(state.startCenter.y + (point.y - state.startPoint.y) / CANVAS_HEIGHT),
      },
      magnifierRadius,
    )
  }

  const updateMagnifierRadiusInteraction = (
    state: Extract<TInteractionState, { type: 'magnifier-radius' }>,
    point: TCoverPoint,
  ): void => {
    magnifierRadiationOnChange(
      state.startCenter,
      getMagnifierRadiusFromCanvasPoint(point, state.startCenter, state.startRadius),
    )
  }

  const updateMagnifierZoomInteraction = (
    state: Extract<TInteractionState, { type: 'magnifier-zoom' }>,
    point: TCoverPoint,
  ): void => {
    const dragDistance = (point.x - state.startPoint.x + point.y - state.startPoint.y) / Math.SQRT2
    const zoomRange = MAGNIFIER_ZOOM_RANGE.MAX - MAGNIFIER_ZOOM_RANGE.MIN
    const nextZoom = state.startZoom + (dragDistance / 120) * zoomRange

    magnifierZoomOnChange(clampMagnifierZoom(nextZoom))
  }

  const handleMovePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!isPrimaryPointer(event)) return

    const startPoint = getCanvasPoint(event)
    if (!startPoint) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionRef.current = {
      pointerId: event.pointerId,
      rotate,
      startCenter: getImageCanvasCenter(position, size, rotate),
      startPoint,
      startSize: size,
      type: 'move',
    }
    setInteractionMode('move')
  }

  const handleResizePointerDown =
    (handle: TImageResizeHandle) =>
    (event: PointerEvent<HTMLButtonElement>): void => {
      if (!isPrimaryPointer(event)) return

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      interactionRef.current = {
        handle,
        pointerId: event.pointerId,
        rotate,
        startCenter: getImageCanvasCenter(position, size, rotate),
        startSize: size,
        type: 'resize',
      }
      setInteractionMode('resize')
    }

  const handleRadiusPointerDown =
    (handle: TImageResizeHandle, localDirection: TCoverPoint) =>
    (event: PointerEvent<HTMLButtonElement>): void => {
      if (!isPrimaryPointer(event)) return

      const point = getCanvasPoint(event)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)

      const nextState: Extract<TInteractionState, { type: 'radius' }> = {
        handle,
        localDirection,
        pointerId: event.pointerId,
        rotate,
        startCenter: getImageCanvasCenter(position, size, rotate),
        startSize: size,
        type: 'radius',
      }

      interactionRef.current = nextState
      setHoveredRadiusHandle(handle)
      setInteractionMode('radius')
      updateRadiusInteraction(nextState, point)
    }

  const handleMagnifierMovePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!isPrimaryPointer(event)) return

    const startPoint = getCanvasPoint(event)
    if (!startPoint) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionRef.current = {
      pointerId: event.pointerId,
      startCenter: magnifierCenter,
      startPoint,
      type: 'magnifier-move',
    }
    setInteractionMode('magnifier-move')
  }

  const handleMagnifierRadiusPointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!isPrimaryPointer(event)) return

    const point = getCanvasPoint(event)
    if (!point) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const nextState: Extract<TInteractionState, { type: 'magnifier-radius' }> = {
      pointerId: event.pointerId,
      startCenter: magnifierCenter,
      startRadius: magnifierRadius,
      type: 'magnifier-radius',
    }

    interactionRef.current = nextState
    setInteractionMode('magnifier-radius')
    updateMagnifierRadiusInteraction(nextState, point)
  }

  const handleMagnifierZoomPointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!isPrimaryPointer(event)) return

    const point = getCanvasPoint(event)
    if (!point) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionRef.current = {
      pointerId: event.pointerId,
      startPoint: point,
      startZoom: magnifierZoom,
      type: 'magnifier-zoom',
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

  const handleImageLoad = (image: HTMLImageElement): void => {
    imageLoadedOnChange(imageUrl, extractDominantColorFromImage(image)?.css ?? null)
  }

  if (!hasImage) {
    return (
      <div className={s.wrapper} style={s.wrapperStyle}>
        <Placeholder onDropFile={onDropFile} onUpload={onUpload} />
      </div>
    )
  }

  const imageFrameStyle: CSSProperties = {
    borderRadius: frameBorderRadiusValue,
    width: imageFrameSize.width,
    height: imageFrameSize.height,
    left: imagePlacement.left,
    top: imagePlacement.top,
    padding: hasGlassBorder ? `${GLASS_FRAME.PADDING_Y}px ${GLASS_FRAME.PADDING_X}px` : 0,
    boxSizing: 'content-box',
    backgroundColor: hasGlassBorder ? 'rgba(255, 255, 255, 0.2)' : undefined,
    backdropFilter: hasGlassBorder ? 'blur(5px)' : undefined,
    WebkitBackdropFilter: hasGlassBorder ? 'blur(5px)' : undefined,
    boxShadow: getImageShadow(shadow),
    transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
  }
  const magnifierImageFrameStyle: CSSProperties = {
    ...imageFrameStyle,
    backgroundColor: hasGlassBorder ? 'rgba(255, 255, 255, 0.16)' : undefined,
    backdropFilter: undefined,
    WebkitBackdropFilter: undefined,
  }
  const editorFrameStyle: CSSProperties = {
    borderRadius: frameBorderRadiusValue,
    width: imageFrameSize.width,
    height: imageFrameSize.height,
    left: imagePlacement.left,
    top: imagePlacement.top,
    padding: hasGlassBorder ? `${GLASS_FRAME.PADDING_Y}px ${GLASS_FRAME.PADDING_X}px` : 0,
    boxSizing: 'content-box',
    transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
  }
  const activeRadiusHandle =
    interactionMode === 'radius' && interactionRef.current?.type === 'radius'
      ? interactionRef.current.handle
      : null
  const radiusHandleLength = getRadiusHandleLength(borderRadius)
  const radiusDotOffset = radiusHandleLength / 2

  const cropViewportStyle: CSSProperties = {
    boxSizing: 'border-box',
    borderRadius: borderRadiusValue,
  }

  const magnifierRenderSize = getMagnifierRenderSize(magnifierRadius)
  const magnifierSizePercent = (magnifierRenderSize / CANVAS_WIDTH) * 100
  const magnifierCanvasLeft = magnifierCenter.x * CANVAS_WIDTH - magnifierRenderSize / 2
  const magnifierCanvasTop = magnifierCenter.y * CANVAS_HEIGHT - magnifierRenderSize / 2
  const magnifierCloneStyle: CSSProperties = {
    width: `${(CANVAS_WIDTH / magnifierRenderSize) * 100}%`,
    height: `${(CANVAS_HEIGHT / magnifierRenderSize) * 100}%`,
    left: `${(-magnifierCanvasLeft / magnifierRenderSize) * 100}%`,
    top: `${(-magnifierCanvasTop / magnifierRenderSize) * 100}%`,
    transform: `scale(${magnifierZoom})`,
    transformOrigin: `${magnifierCenter.x * 100}% ${magnifierCenter.y * 100}%`,
  }
  const magnifierStyle: CSSProperties = {
    width: `${magnifierSizePercent}%`,
    left: `${magnifierCenter.x * 100}%`,
    top: `${magnifierCenter.y * 100}%`,
    ...getMagnifierAppearanceStyle(magnifierAppearance),
  }
  const showMagnifierHandles =
    magnifierHovered ||
    interactionMode === 'magnifier-move' ||
    interactionMode === 'magnifier-radius' ||
    interactionMode === 'magnifier-zoom'

  const renderCoverContent = (isMagnifierClone = false): ReactNode => (
    <div className={s.contentLayer} style={wrapperBackgroundStyle}>
      <div
        className={s.cn(s.imageFrame, interactionMode !== 'idle' && s.imageFrameActive)}
        style={isMagnifierClone ? magnifierImageFrameStyle : imageFrameStyle}
      >
        <div
          className={s.cn(s.cropViewport, interactionMode !== 'idle' && s.cropViewportActive)}
          style={cropViewportStyle}
        >
          <img
            className={s.cn(s.image, interactionMode !== 'idle' && s.imageActive)}
            src={imageUrl}
            alt=''
            draggable={false}
            onLoad={isMagnifierClone ? undefined : (event) => handleImageLoad(event.currentTarget)}
          />
        </div>
        <BorderRender
          className={s.borderHighlight}
          borderRadius={frameBorderRadiusValue}
          borderHighlight={borderHighlight}
          framePadding={framePadding}
          size={size}
        />
      </div>
    </div>
  )

  const renderMagnifier = (): ReactNode => {
    if (!hasMagnifier) return null

    return (
      <div
        className={s.cn(
          s.magnifier,
          interactionMode === 'magnifier-move' && s.magnifierMoving,
          interactionMode === 'magnifier-radius' && s.magnifierResizing,
          interactionMode === 'magnifier-zoom' && s.magnifierZooming,
        )}
        style={magnifierStyle}
        aria-label='Move magnifier'
        onPointerDown={handleMagnifierMovePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerEnter={() => setMagnifierHovered(true)}
        onPointerLeave={() => setMagnifierHovered(false)}
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
              onPointerDown={handleMagnifierRadiusPointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            <button
              type='button'
              className={s.magnifierZoomHandle}
              aria-label='Adjust magnifier zoom'
              onPointerDown={handleMagnifierZoomPointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className={s.wrapper} style={s.wrapperStyle}>
      {hasImage && (
        <>
          {renderCoverContent()}
          {renderMagnifier()}
          <div
            className={s.cn(
              s.editorFrame,
              showMagnifierHandles && s.editorFrameHidden,
              interactionMode !== 'idle' && s.editorFrameActive,
              interactionMode === 'idle' && s.editorFrameMove,
              interactionMode === 'move' && s.editorFrameMoving,
              interactionMode === 'resize' && s.editorFrameResizing,
            )}
            style={editorFrameStyle}
            aria-label='Move image'
            onPointerDown={handleMovePointerDown}
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
                  onPointerEnter={() => setHoveredRadiusHandle(handle)}
                  onPointerLeave={() => setHoveredRadiusHandle(null)}
                >
                  <button
                    type='button'
                    className={s.cn(s.resizeHandle, s[cursorClassNameKey])}
                    aria-label={label}
                    onPointerDown={handleResizePointerDown(handle)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
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
                          onPointerDown={handleRadiusPointerDown(handle, direction)}
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
        </>
      )}
    </div>
  )
}

export default Cover
