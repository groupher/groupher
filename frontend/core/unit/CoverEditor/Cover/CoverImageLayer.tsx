import type { FC, PointerEventHandler, WheelEventHandler } from 'react'

import type { TCoverCanvas, TCoverImageConfig } from '../spec'
import BorderRender from './BorderRender'
import useSalon from './salon'
import useImageRenderState from './useImageRenderState'

type TProps = {
  image: TCoverImageConfig
  isInteracting: boolean
  isMagnifierClone?: boolean
  onImageLoad?: (image: HTMLImageElement) => void
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerMove?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
  onWheel?: WheelEventHandler<HTMLDivElement>
  renderCanvas: TCoverCanvas
}

const CoverImageLayer: FC<TProps> = ({
  image,
  isInteracting,
  isMagnifierClone = false,
  onImageLoad,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  renderCanvas,
}) => {
  const s = useSalon()
  const getImageRenderState = useImageRenderState(renderCanvas)
  const {
    cropViewportStyle,
    frameBorderRadiusValue,
    framePadding,
    imageFrameStyle,
    imageStyle,
    magnifierImageFrameStyle,
  } = getImageRenderState(image)

  return (
    <div
      className={s.cn(s.imageFrame, isInteracting && s.imageFrameActive)}
      style={isMagnifierClone ? magnifierImageFrameStyle : imageFrameStyle}
      onPointerDown={isMagnifierClone ? undefined : onPointerDown}
      onPointerMove={isMagnifierClone ? undefined : onPointerMove}
      onPointerUp={isMagnifierClone ? undefined : onPointerUp}
      onPointerCancel={isMagnifierClone ? undefined : onPointerUp}
      onWheel={isMagnifierClone ? undefined : onWheel}
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
          style={imageStyle}
          onLoad={
            isMagnifierClone || !onImageLoad
              ? undefined
              : (event) => onImageLoad(event.currentTarget)
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

export default CoverImageLayer
