import { isEmpty } from 'ramda'
import { useRef, useState } from 'react'
import type { CSSProperties, FC, PointerEvent } from 'react'

import { parseWallpaper } from '~/wallpaper'

import { GLASS_FRAME, IMAGE_SIZE_RANGE, LIGHT_RENDER_OPACITY, LIGHT_RENDER_SIZE } from '../constant'
import { getImageShadow } from '../helper'
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

type TInteractionMode = 'idle' | 'move' | 'radius' | 'resize'

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

const Cover: FC<TProps> = ({ imageUrl, onDropFile, onUpload }) => {
  const {
    borderRadiusOnChange,
    imageLoadedOnChange,
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
    hasLight,
    lightCenter,
    lightRadius,
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
    ? { backgroundImage: parseWallpaper(wallpapers, wallpaper).background }
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

  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    const state = interactionRef.current
    if (!state || state.pointerId !== event.pointerId) return
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return

    const point = getCanvasPoint(event)
    if (!point) return

    event.preventDefault()

    if (state.type === 'move') updateMoveInteraction(state, point)
    else if (state.type === 'resize') updateResizeInteraction(state, point)
    else updateRadiusInteraction(state, point)
  }

  const handlePointerUp = (event: PointerEvent<HTMLElement>): void => {
    const state = interactionRef.current
    if (!state || state.pointerId !== event.pointerId) return

    handlePointerMove(event)
    finishInteraction(event)
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
    transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
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
    boxShadow: getImageShadow(shadow),
    borderRadius: borderRadiusValue,
  }
  const lightRenderSize =
    LIGHT_RENDER_SIZE.MIN + (LIGHT_RENDER_SIZE.MAX - LIGHT_RENDER_SIZE.MIN) * lightRadius
  const lightRenderOpacity =
    LIGHT_RENDER_OPACITY.MIN + (LIGHT_RENDER_OPACITY.MAX - LIGHT_RENDER_OPACITY.MIN) * lightRadius

  const lightStyle: CSSProperties = {
    top: `${lightCenter.y * 100}%`,
    left: `${lightCenter.x * 100}%`,
    width: `${lightRenderSize}px`,
    height: `${lightRenderSize}px`,
    background: `radial-gradient(
      ellipse at center,
      rgba(255, 255, 255, ${lightRenderOpacity}) 0%,
      rgba(255, 255, 255, 0) 65%
    )`,
  }

  return (
    <div
      ref={wrapperRef}
      className={s.wrapper}
      style={{
        ...s.wrapperStyle,
        ...wrapperBackgroundStyle,
      }}
    >
      {hasImage && (
        <>
          <div
            className={s.cn(s.imageFrame, interactionMode !== 'idle' && s.imageFrameActive)}
            style={imageFrameStyle}
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
                onLoad={() => imageLoadedOnChange(imageUrl)}
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
          {hasLight && <div className={s.light} style={lightStyle} />}
          <div
            className={s.cn(
              s.editorFrame,
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
            <div className={s.editorBorder} style={{ borderRadius: frameBorderRadiusValue }} />
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
                      <span className={s.radiusGuide} style={guideStyle} />
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
