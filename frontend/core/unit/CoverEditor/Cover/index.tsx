import { isEmpty } from 'ramda'
import type { CSSProperties, FC } from 'react'

import { parseWallpaper } from '~/wallpaper'

import {
  IMAGE_BORDER_RADIUS,
  IMAGE_RATIO,
  IMAGE_SHADOW,
  IMAGE_SIZE_RANGE,
  SETTING_LEVEL,
} from '../constant'
import useSalon from '../salon/cover'
import useLogic from '../useLogic'
import BorderHighlight from './BorderHighlight'
import Placeholder from './Placeholder'

type TProps = {
  imageUrl: string
  onUpload: () => void
}

const Cover: FC<TProps> = ({ imageUrl, onUpload }) => {
  const { imageLoadedOnChange, tuningSetting: setting } = useLogic()
  const {
    ratio,
    size,
    shadowLevel,
    hasGlassBorder,
    borderRadiusLevel,
    borderHighlight,
    hasLight,
    lightCenter,
    wallpaper,
    wallpapers,
    rotate,
    position,
  } = setting
  const s = useSalon()

  const hasImage = !isEmpty(imageUrl)
  const imageFrameSize = s.getResponsiveImageSize(size, ratio)
  const imagePlacement = s.getImagePlacement(position, size, ratio, rotate)
  const hasShadow = shadowLevel !== SETTING_LEVEL.L1
  const hasWallpaper = !isEmpty(wallpaper)
  const isFullFrame = size === IMAGE_SIZE_RANGE.MAX && ratio === IMAGE_RATIO.SCREEN && rotate === 0
  const shouldShowTransparentGrid = !hasWallpaper && !isFullFrame
  const wrapperBackgroundStyle: CSSProperties = hasWallpaper
    ? { backgroundImage: parseWallpaper(wallpapers, wallpaper).background }
    : shouldShowTransparentGrid
      ? s.transparentGridStyle
      : {}

  if (!hasImage) {
    return (
      <div className={s.wrapper} style={s.wrapperStyle}>
        <Placeholder onUpload={onUpload} />
      </div>
    )
  }

  const imageFrameStyle: CSSProperties = {
    borderRadius: s.pixelAdd(IMAGE_BORDER_RADIUS[borderRadiusLevel], 5),
    width: imageFrameSize.width,
    height: imageFrameSize.height,
    left: imagePlacement.left,
    top: imagePlacement.top,
    padding: hasGlassBorder ? '6.5px 7.5px' : 0,
    boxSizing: 'content-box',
    backgroundColor: hasGlassBorder ? 'rgba(255, 255, 255, 0.2)' : undefined,
    backdropFilter: hasGlassBorder ? 'blur(5px)' : undefined,
    WebkitBackdropFilter: hasGlassBorder ? 'blur(5px)' : undefined,
    transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
  }

  const cropViewportStyle: CSSProperties = {
    boxSizing: 'border-box',
    boxShadow: hasShadow ? IMAGE_SHADOW[shadowLevel] : undefined,
    borderRadius: IMAGE_BORDER_RADIUS[borderRadiusLevel],
  }

  const lightStyle: CSSProperties = {
    top: `${lightCenter.y * 100}%`,
    left: `${lightCenter.x * 100}%`,
    background: `radial-gradient(
      ellipse at center,
      rgba(255, 255, 255, 0.2) 0%,
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
            <BorderHighlight
              className={s.borderHighlight}
              borderRadius={IMAGE_BORDER_RADIUS[borderRadiusLevel]}
              borderHighlight={borderHighlight}
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
