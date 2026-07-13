import type { CSSProperties, FC, PointerEventHandler, ReactNode } from 'react'

import { getCoverImageVarValue, getMagnifierRenderSize } from '../coverImageCssVars'
import { getMagnifierAppearanceStyle } from '../helper'
import type { TCoverCanvas, TCoverImageConfig } from '../spec'
import useSalon from './salon'

type TProps = {
  cloneContent: ReactNode
  image: TCoverImageConfig
  interaction: 'idle' | 'move' | 'radius' | 'zoom'
  onHoverChange: (hovered: boolean) => void
  onMovePointerDown: PointerEventHandler<HTMLDivElement>
  onPointerMove: PointerEventHandler<HTMLElement>
  onPointerUp: PointerEventHandler<HTMLElement>
  onRadiusPointerDown: PointerEventHandler<HTMLButtonElement>
  onZoomPointerDown: PointerEventHandler<HTMLButtonElement>
  renderCanvas: TCoverCanvas
  showHandles: boolean
}

const MagnifierLayer: FC<TProps> = ({
  cloneContent,
  image,
  interaction,
  onHoverChange,
  onMovePointerDown,
  onPointerMove,
  onPointerUp,
  onRadiusPointerDown,
  onZoomPointerDown,
  renderCanvas,
  showHandles,
}) => {
  const s = useSalon()
  const renderSize = getMagnifierRenderSize(image.magnifier.radius)
  const sizePercent = (renderSize / renderCanvas.canvasWidth) * 100
  const canvasLeft = image.magnifier.center.x * renderCanvas.canvasWidth - renderSize / 2
  const canvasTop = image.magnifier.center.y * renderCanvas.canvasHeight - renderSize / 2
  const imageVar = (key: string, fallback: string | number): string =>
    getCoverImageVarValue(image.which, key, fallback)
  const cloneStyle: CSSProperties = {
    width: imageVar('magnifier-clone-width', `${(renderCanvas.canvasWidth / renderSize) * 100}%`),
    height: imageVar(
      'magnifier-clone-height',
      `${(renderCanvas.canvasHeight / renderSize) * 100}%`,
    ),
    left: imageVar('magnifier-clone-left', `${(-canvasLeft / renderSize) * 100}%`),
    top: imageVar('magnifier-clone-top', `${(-canvasTop / renderSize) * 100}%`),
    transform: imageVar('magnifier-clone-transform', `scale(${image.magnifier.zoom})`),
    transformOrigin: imageVar(
      'magnifier-clone-origin',
      `${image.magnifier.center.x * 100}% ${image.magnifier.center.y * 100}%`,
    ),
  }
  const style: CSSProperties = {
    width: imageVar('magnifier-width', `${sizePercent}%`),
    left: imageVar('magnifier-left', `${image.magnifier.center.x * 100}%`),
    top: imageVar('magnifier-top', `${image.magnifier.center.y * 100}%`),
    zIndex: imageVar('magnifier-z-index', image.zIndex + 2),
    ...getMagnifierAppearanceStyle(image.magnifier),
  }

  return (
    <div
      className={s.cn(
        s.magnifier,
        interaction === 'move' && s.magnifierMoving,
        interaction === 'radius' && s.magnifierResizing,
        interaction === 'zoom' && s.magnifierZooming,
      )}
      style={style}
      aria-label='Move magnifier'
      onPointerDown={onMovePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
    >
      <div className={s.magnifierViewport}>
        <div className={s.magnifierClone} style={cloneStyle}>
          {cloneContent}
        </div>
      </div>
      {showHandles && (
        <>
          <button
            type='button'
            className={s.magnifierRadiusHandle}
            aria-label='Adjust magnifier size'
            onPointerDown={onRadiusPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          <button
            type='button'
            className={s.magnifierZoomHandle}
            aria-label='Adjust magnifier zoom'
            onPointerDown={onZoomPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </>
      )}
    </div>
  )
}

export default MagnifierLayer
