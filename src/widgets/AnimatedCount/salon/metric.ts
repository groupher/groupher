import type { TThemeMap, TColorName, TSize } from '~/spec'

import SIZE from '~/const/size'
import { COLOR_NAME } from '~/const/colors'

export const getFontSize = (size: TSize): number => {
  switch (size) {
    case SIZE.TINY: {
      return 13
    }
    case SIZE.MEDIUM: {
      return 16
    }
    case SIZE.LARGE: {
      return 26
    }
    case SIZE.HUGE: {
      return 30
    }
    default: {
      return 15
    }
  }
}

export const getFlipNumOffset = (size: TSize): number => {
  switch (size) {
    case SIZE.MEDIUM: {
      return 7
    }
    default: {
      return 6
    }
  }
}

export const getCountColor = (
  active: boolean,
  themeMap: TThemeMap,
  primaryColor: TColorName,
  count: number,
): string => {
  if (count === 0) return themeMap.text.digest

  if (primaryColor === COLOR_NAME.BLACK) {
    return themeMap.text.digest
  }

  return active ? themeMap.rainbow[primaryColor.toLowerCase()] : themeMap.text.digest
}
