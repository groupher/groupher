import type { FC } from 'react'
import { isEmpty } from 'ramda'

import { parseWallpaper } from '~/wallpaper'

import Placeholder from './Placeholder'

import { IMAGE_POS, IMAGE_SHADOW, IMAGE_BORDER_RADIUS, IMAGE_SIZE } from '../constant'

import useLogic from '../useLogic'
import useSalon from '../salon/cover'

type TProps = {
  imageUrl: string
}

const Cover: FC<TProps> = ({ imageUrl }) => {
  const { toolboxSetting: setting } = useLogic()
  const {
    linearBorderPos,
    ratio,
    size,
    shadowLevel,
    hasGlassBorder,
    borderRadiusLevel,
    lightPos,
    wallpaper,
    wallpapers,
    rotate,
    pos,
  } = setting
  const s = useSalon({ linearBorderPos })

  const hasImage = !isEmpty(imageUrl)

  if (!hasImage) {
    return <Placeholder />
  }

  const glassBorderStyle = {
    borderRadius: s.pixelAdd(IMAGE_BORDER_RADIUS[borderRadiusLevel], 5),
    minWidth: s.pixelAdd(s.getImageSize(size, ratio).width, hasGlassBorder ? 15 : 0),
    minHeight: s.pixelAdd(s.getImageSize(size, ratio).height, hasGlassBorder ? 13 : 0),
    backgroundColor: hasGlassBorder ? 'rgba(255, 255, 255, 0.2);backdrop-filter: blur(5px);' : '',
    transform: `${s.getImageTranslate(pos, size)} rotate(${rotate}deg)`,
  }

  const imageStyle = {
    border: linearBorderPos === 'none' ? 'none' : '1px solid',
    backgroundImage: s.getLinearBorder(linearBorderPos),
    backgroundOrigin: 'border-box',
    backgroundClip: 'content-box, border-box',
    borderImageSlice: 1,
    width: s.getImageSize(size, ratio).width,
    height: s.getImageSize(size, ratio).height,
    marginTop: size === IMAGE_SIZE.LARGE ? '-5px' : 0,
    boxShadow: IMAGE_SHADOW[shadowLevel],
    borderRadius: IMAGE_BORDER_RADIUS[borderRadiusLevel],
  }

  const lightStyle = {
    top: `calc(50% + ${s.getLightPos(lightPos).top})`,
    left: `calc(50% + ${s.getLightPos(lightPos).left})`,
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
        backgroundImage: hasImage ? parseWallpaper(wallpapers, wallpaper).background : 'none',
      }}
    >
      {hasImage && (
        <div className={s.glassBorder} style={glassBorderStyle}>
          <img src={imageUrl} style={imageStyle} alt="" />
          {lightPos !== IMAGE_POS.NONE && <div className={s.light} style={lightStyle} />}
        </div>
      )}
    </div>
  )
}

export default Cover
