import { includes, keys } from 'ramda'

import { GRADIENT_WALLPAPER } from '~/const/wallpaper'

const LEGACY_WALLPAPER_NAME = {
  PINK: 'pink',
  GREY: 'grey',
} as const

export const getPathGradient = (wallpaper: string): string => {
  if (!includes(wallpaper, keys(GRADIENT_WALLPAPER))) {
    return '#f2bc5a,#f76b6b'
  }

  if (wallpaper === LEGACY_WALLPAPER_NAME.PINK) {
    return '#f8be6d,#c479de'
  }

  if (wallpaper === LEGACY_WALLPAPER_NAME.GREY) {
    return '#E1D5CC,#955D29'
  }

  const { colors } = GRADIENT_WALLPAPER[wallpaper]

  if (!colors) return ''

  const color1 = colors[0]
  const color2 = colors[colors.length - 1]

  return `${color1}, ${color2}`
}

export const getCursorGradient = (wallpaper: string): string => {
  return getPathGradient(wallpaper).split(',')[1]
}
