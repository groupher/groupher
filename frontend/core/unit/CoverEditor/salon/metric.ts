import { GRADIENT_DIRECTION } from '~/const/wallpaper'
import type { TWallpaperGradientDir } from '~/spec'

import { IMAGE_POS, IMAGE_RATIO_SIZE, IMAGE_SIZE, LINEAR_BORDER } from '../constant'
import type { TImagePos, TImageRadio, TImageSize, TImageSizeValue, TLinearBorderPos } from '../spec'

export const getImageSize = (size: TImageSize, ratio: TImageRadio): TImageSizeValue => {
  return IMAGE_RATIO_SIZE[ratio][size]
}

type TTranslateOffset = {
  x: number
  y: number
}

const getTranslateOffset = (size: TImageSize): TTranslateOffset => {
  let xOffset = 40
  let yOffset = 40

  switch (size) {
    case IMAGE_SIZE.MEDIUM: {
      xOffset = 50
      yOffset = 53
      break
    }

    case IMAGE_SIZE.SMALL: {
      xOffset = 100
      yOffset = 103
      break
    }

    default: {
      break
    }
  }

  return {
    x: xOffset,
    y: yOffset,
  }
}

export const getImageTranslate = (pos: TImagePos, size: TImageSize): string => {
  let x = '0px'
  let y = '3px'

  const { x: xOffset, y: yOffset } = getTranslateOffset(size)

  switch (pos) {
    case IMAGE_POS.TOP_LEFT: {
      x = `-${xOffset}px`
      y = `-${yOffset}px`
      break
    }

    case IMAGE_POS.TOP_CENTER: {
      y = `-${yOffset}px`
      break
    }

    case IMAGE_POS.TOP_RIGHT: {
      x = `${xOffset}px`
      y = `-${yOffset}px`
      break
    }

    case IMAGE_POS.CENTER_LEFT: {
      x = `-${xOffset}px`
      break
    }

    case IMAGE_POS.CENTER_RIGHT: {
      x = `${xOffset}px`
      break
    }

    case IMAGE_POS.BOTTOM_LEFT: {
      x = `-${xOffset}px`
      y = `${yOffset}px`
      break
    }

    case IMAGE_POS.BOTTOM_CENTER: {
      y = `${yOffset}px`
      break
    }

    case IMAGE_POS.BOTTOM_RIGHT: {
      x = `${xOffset}px`
      y = `${yOffset}px`
      break
    }

    // center
    default: {
      break
    }
  }

  return `translate(${x}, ${y})`
}

type TLightPos = {
  size: number
  top: string
  left: string
}

export const getLightPos = (pos: TImagePos): TLightPos => {
  const size = 300
  let top = '-205px'
  let left = '-200px'

  switch (pos) {
    case IMAGE_POS.TOP_LEFT: {
      top = '-350px'
      left = '-450px'
      break
    }

    case IMAGE_POS.TOP_CENTER: {
      top = '-350px'
      break
    }

    case IMAGE_POS.TOP_RIGHT: {
      top = '-350px'
      left = '45px'
      break
    }

    case IMAGE_POS.CENTER_LEFT: {
      left = '-450px'
      break
    }

    case IMAGE_POS.CENTER_RIGHT: {
      left = '45px'
      break
    }

    case IMAGE_POS.BOTTOM_LEFT: {
      left = '-420px'
      top = '-50px'
      break
    }

    case IMAGE_POS.BOTTOM_CENTER: {
      top = '-50px'
      break
    }

    case IMAGE_POS.BOTTOM_RIGHT: {
      left = '45px'
      top = '-50px'
      break
    }

    // center
    default: {
      break
    }
  }

  return {
    size,
    top,
    left,
  }
}

export const getLinearBorder = (
  pos: TLinearBorderPos,
  _active = false,
  _isLightTheme = true,
): string => {
  // const themeKey = isLightTheme ? 'DEFAULT' : 'dark'
  // TODO:
  const color = 'wheat' // active ? colors.text.digest[themeKey] : colors.text.hint[themeKey]

  switch (pos) {
    case LINEAR_BORDER.TOP_LEFT: {
      return `linear-gradient(transparent, transparent), 
      linear-gradient(to left top, transparent, transparent 62%, ${color})`
    }
    case LINEAR_BORDER.TOP_RIGHT:
      return `linear-gradient(transparent, transparent),
              linear-gradient(to right top, transparent, transparent 62%, ${color})`
    case LINEAR_BORDER.TOP_ALL:
      return `linear-gradient(transparent, transparent),
              linear-gradient(to top, transparent, transparent 20%, ${color})`
    case LINEAR_BORDER.BOTTOM_LEFT:
      return `linear-gradient(transparent, transparent), 
              linear-gradient(to left bottom, transparent, transparent 62%, ${color})`
    case LINEAR_BORDER.BOTTOM_RIGHT:
      return `linear-gradient(transparent, transparent), 
              linear-gradient(to right bottom, transparent, transparent 62%, ${color})`
    case LINEAR_BORDER.BOTTOM_ALL:
      return `linear-gradient(transparent, transparent), 
              linear-gradient(to bottom, transparent, transparent 20%, ${color})`
    case LINEAR_BORDER.LEFT_ALL:
      return `linear-gradient(transparent, transparent), 
              linear-gradient(to left, transparent, transparent 20%, ${color})`
    case LINEAR_BORDER.RIGHT_ALL:
      return `linear-gradient(transparent, transparent),
              linear-gradient(to right, transparent, transparent 20%, ${color})`
    case LINEAR_BORDER.NONE:
      return 'none'
    default:
      return `linear-gradient(transparent, transparent),
              linear-gradient(to left, transparent, transparent, ${color})`
  }
}

export const getBgGradientDirAngle = (dir: TWallpaperGradientDir): string => {
  switch (dir) {
    case GRADIENT_DIRECTION.TOP: {
      return '90deg'
    }
    case GRADIENT_DIRECTION.TOP_RIGHT: {
      return '135deg'
    }
    case GRADIENT_DIRECTION.RIGHT: {
      return '180deg'
    }
    case GRADIENT_DIRECTION.BOTTOM_RIGHT: {
      return '225deg'
    }
    case GRADIENT_DIRECTION.BOTTOM: {
      return '270deg'
    }
    case GRADIENT_DIRECTION.BOTTOM_LEFT: {
      return '315deg'
    }
    case GRADIENT_DIRECTION.LEFT: {
      return '0'
    }
    // TOP_LEFT
    default: {
      return '45deg'
    }
  }
}
