import type { CSSProperties, FC, PointerEventHandler, WheelEventHandler } from 'react'

import { IMAGE_EDIT_MODE, IMAGE_EDIT_MODE_LABEL } from '../constant'
import type { TImageResizeHandle } from '../salon/metric'
import type { TCoverCanvas, TCoverImageConfig, TCoverPoint, TImageEditMode } from '../spec'
import ImageModeToggle from './ImageModeToggle'
import useSalon from './salon'
import useImageRenderState from './useImageRenderState'

type THandleConfig = {
  classNameKey:
    | 'resizeHandleTopLeft'
    | 'resizeHandleTopRight'
    | 'resizeHandleBottomLeft'
    | 'resizeHandleBottomRight'
  cursorClassNameKey: 'resizeCursorNesw' | 'resizeCursorNwse'
  handle: TImageResizeHandle
  label: string
}

const HANDLES: THandleConfig[] = [
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

const RADIUS_VISUAL: Record<TImageResizeHandle, { axis: { x: 1; y: -1 | 1 }; transform: string }> =
  {
    'top-left': { axis: { x: 1, y: -1 }, transform: 'translate(-50%, -50%) rotate(-45deg)' },
    'top-right': { axis: { x: 1, y: 1 }, transform: 'translate(-50%, -50%) rotate(45deg)' },
    'bottom-left': { axis: { x: 1, y: 1 }, transform: 'translate(-50%, -50%) rotate(45deg)' },
    'bottom-right': { axis: { x: 1, y: -1 }, transform: 'translate(-50%, -50%) rotate(-45deg)' },
  }

const getDotTransform = (axis: { x: 1; y: -1 | 1 }, offset: number): string =>
  `translate(calc(-50% + ${(axis.x * offset) / Math.SQRT2}px), calc(-50% + ${(axis.y * offset) / Math.SQRT2}px))`

type TProps = {
  activeRadiusHandle: TImageResizeHandle | null
  editMode: TImageEditMode
  hidden: boolean
  hoveredRadiusHandle: TImageResizeHandle | null
  image: TCoverImageConfig
  interaction: 'idle' | 'move' | 'resize' | 'crop' | 'other'
  onEditModeChange: (mode: TImageEditMode) => void
  onPointerDown: PointerEventHandler<HTMLDivElement>
  onPointerMove: PointerEventHandler<HTMLElement>
  onPointerUp: PointerEventHandler<HTMLElement>
  onRadiusPointerDown: (
    handle: TImageResizeHandle,
    direction: TCoverPoint,
  ) => PointerEventHandler<HTMLButtonElement>
  onResizePointerDown: (handle: TImageResizeHandle) => PointerEventHandler<HTMLElement>
  onRadiusHoverChange: (handle: TImageResizeHandle | null) => void
  onWheel: WheelEventHandler<HTMLDivElement>
  renderCanvas: TCoverCanvas
}

const ImageEditorFrame: FC<TProps> = ({
  activeRadiusHandle,
  editMode,
  hidden,
  hoveredRadiusHandle,
  image,
  interaction,
  onEditModeChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRadiusPointerDown,
  onResizePointerDown,
  onRadiusHoverChange,
  onWheel,
  renderCanvas,
}) => {
  const s = useSalon()
  const { editorFrameStyle, frameBorderRadiusValue } = useImageRenderState(renderCanvas)(image)
  const isInteracting = interaction !== 'idle'
  const radiusLength = Math.min(64, Math.max(24, 24 + image.borderRadius))
  const dotOffset = radiusLength / 2

  return (
    <div
      className={s.cn(
        s.editorFrame,
        hidden && s.editorFrameHidden,
        isInteracting && s.editorFrameActive,
        interaction === 'idle' && editMode === IMAGE_EDIT_MODE.MOVE && s.editorFrameMove,
        interaction === 'idle' && editMode === IMAGE_EDIT_MODE.REPOSITION && s.editorFrameCropping,
        interaction === 'move' && s.editorFrameMoving,
        interaction === 'crop' && s.editorFrameCroppingActive,
        interaction === 'resize' && s.editorFrameResizing,
      )}
      style={editorFrameStyle}
      aria-label={IMAGE_EDIT_MODE_LABEL[editMode]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <ImageModeToggle
        active={editMode === IMAGE_EDIT_MODE.REPOSITION || isInteracting}
        mode={editMode}
        onChange={onEditModeChange}
      />
      <div
        className={s.cn(s.editorBorder, s.editorBorderTone)}
        style={{ borderRadius: frameBorderRadiusValue }}
      />
      {editMode === IMAGE_EDIT_MODE.MOVE &&
        HANDLES.map(({ classNameKey, cursorClassNameKey, handle, label }) => {
          const visible = hoveredRadiusHandle === handle || activeRadiusHandle === handle
          const visual = RADIUS_VISUAL[handle]
          const guideStyle: CSSProperties = {
            transform: visual.transform,
            width: `${radiusLength}px`,
          }
          const bridgeStyle: CSSProperties = {
            height: `${radiusLength + 16}px`,
            transform: visual.transform,
            width: `${radiusLength + 16}px`,
          }
          const dots = [-1, 1].map((sign) => ({
            direction: { x: (sign * visual.axis.x) as -1 | 1, y: (sign * visual.axis.y) as -1 | 1 },
            key: sign,
            transform: getDotTransform(visual.axis, sign * dotOffset),
          }))

          return (
            <div
              key={handle}
              className={s.cn(s.resizeHandleGroup, s[classNameKey])}
              onPointerDown={onResizePointerDown(handle)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerEnter={() => onRadiusHoverChange(handle)}
              onPointerLeave={() => onRadiusHoverChange(null)}
            >
              <button
                type='button'
                className={s.cn(s.resizeHandle, s[cursorClassNameKey])}
                aria-label={label}
              />
              {visible && (
                <>
                  <span className={s.radiusBridge} style={bridgeStyle} />
                  <span className={s.cn(s.radiusGuide, s.radiusGuideTone)} style={guideStyle} />
                  {dots.map(({ direction, key, transform }) => (
                    <button
                      key={key}
                      type='button'
                      className={s.radiusDot}
                      style={{ transform }}
                      aria-label={`Adjust corner radius from ${handle}`}
                      onPointerDown={onRadiusPointerDown(handle, direction)}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerUp}
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

export default ImageEditorFrame
