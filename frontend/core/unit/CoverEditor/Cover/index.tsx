import { isEmpty } from 'ramda'
import { useRef, useState } from 'react'
import type { CSSProperties, FC, PointerEvent } from 'react'

import { parseWallpaper } from '~/wallpaper'

import { GLASS_FRAME, IMAGE_SIZE_RANGE, LIGHT_RENDER_OPACITY, LIGHT_RENDER_SIZE } from '../constant'
import { getImageShadow } from '../helper'
import {
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

type TInteractionMode = 'idle' | 'move' | 'resize'

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

const RESIZE_HANDLES: {
  classNameKey:
    | 'resizeHandleTopLeft'
    | 'resizeHandleTopRight'
    | 'resizeHandleBottomLeft'
    | 'resizeHandleBottomRight'
  handle: TImageResizeHandle
  label: string
}[] = [
  { handle: 'top-left', classNameKey: 'resizeHandleTopLeft', label: 'Resize from top left' },
  { handle: 'top-right', classNameKey: 'resizeHandleTopRight', label: 'Resize from top right' },
  {
    handle: 'bottom-left',
    classNameKey: 'resizeHandleBottomLeft',
    label: 'Resize from bottom left',
  },
  {
    handle: 'bottom-right',
    classNameKey: 'resizeHandleBottomRight',
    label: 'Resize from bottom right',
  },
]

const Cover: FC<TProps> = ({ imageUrl, onDropFile, onUpload }) => {
  const { imageLoadedOnChange, positionOnChange, sizeOnChange, tuningSetting: setting } = useLogic()
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    interactionRef.current = null
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

  const handlePointerMove = (event: PointerEvent<HTMLElement>): void => {
    const state = interactionRef.current
    if (!state || state.pointerId !== event.pointerId) return
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return

    const point = getCanvasPoint(event)
    if (!point) return

    event.preventDefault()

    if (state.type === 'move') updateMoveInteraction(state, point)
    else updateResizeInteraction(state, point)
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
            <div className={s.cropViewport} style={cropViewportStyle}>
              <img
                className={s.image}
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
            {RESIZE_HANDLES.map(({ classNameKey, handle, label }) => (
              <button
                key={handle}
                type='button'
                className={s.cn(s.resizeHandle, s[classNameKey])}
                aria-label={label}
                onPointerDown={handleResizePointerDown(handle)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Cover
