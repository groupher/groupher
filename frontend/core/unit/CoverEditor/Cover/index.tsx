import { isEmpty } from 'ramda'
import type { CSSProperties, FC } from 'react'

import { parseWallpaper } from '~/wallpaper'

import {
  GLASS_FRAME,
  IMAGE_RATIO,
  IMAGE_SIZE_RANGE,
  LIGHT_RENDER_OPACITY,
  LIGHT_RENDER_SIZE,
} from '../constant'
import { getImageShadow } from '../helper'
import useLogic from '../useLogic'
import BorderRender from './BorderRender'
import Placeholder from './Placeholder'
import useSalon from './salon'

type TProps = {
  imageUrl: string
  onDropFile: (file: File) => void
  onUpload: () => void
}

const Cover: FC<TProps> = ({ imageUrl, onDropFile, onUpload }) => {
  const { imageLoadedOnChange, tuningSetting: setting } = useLogic()
  const {
    ratio,
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

  const hasImage = !isEmpty(imageUrl)
  const imageFrameSize = s.getResponsiveImageSize(size, ratio)
  const imagePlacement = s.getImagePlacement(position, size, ratio, rotate)
  const hasWallpaper = !isEmpty(wallpaper)
  const isFullFrame = size === IMAGE_SIZE_RANGE.MAX && ratio === IMAGE_RATIO.SCREEN && rotate === 0
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
      className={s.wrapper}
      style={{
        ...s.wrapperStyle,
        ...wrapperBackgroundStyle,
      }}
    >
      {hasImage && (
        <>
          <div className={s.imageFrame} style={imageFrameStyle}>
            <div className={s.cropViewport} style={cropViewportStyle}>
              <img
                className={s.image}
                src={imageUrl}
                alt=''
                onLoad={() => imageLoadedOnChange(imageUrl)}
              />
            </div>
            <BorderRender
              className={s.borderHighlight}
              borderRadius={frameBorderRadiusValue}
              borderHighlight={borderHighlight}
              framePadding={framePadding}
              ratio={ratio}
              size={size}
            />
          </div>
          {hasLight && <div className={s.light} style={lightStyle} />}
        </>
      )}
    </div>
  )
}

export default Cover
