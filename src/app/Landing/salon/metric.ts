import { keys, includes } from 'ramda'

import { GRADIENT_WALLPAPER, GRADIENT_WALLPAPER_NAME } from '~/const/wallpaper'

export const getGlowBackground = (wallpaper: string): string => {
  if (!includes(wallpaper, keys(GRADIENT_WALLPAPER))) {
    return `radial-gradient(circle at 40% 90%,#eeeeee 0,transparent 18%), 
            radial-gradient(circle at 58% 100%,#CACACE 0,transparent 30%)`
  }

  // @ts-ignore
  const { colors } = GRADIENT_WALLPAPER[wallpaper]

  if (!colors) return ''

  const color1 = colors[0]
  const color2 = colors[colors.length - 1]

  return `radial-gradient(circle at 40% 90%, ${color1} 0, transparent 18%), 
          radial-gradient(circle at 58% 100%, ${color2} 0, transparent 30%)`
}

export const getGlowOpacity = (wallpaper: string): number => {
  switch (wallpaper) {
    case GRADIENT_WALLPAPER_NAME.GREEN: {
      return 0.4
    }

    case GRADIENT_WALLPAPER_NAME.ORANGE: {
      return 0.3
    }

    case GRADIENT_WALLPAPER_NAME.PURPLE: {
      return 0.4
    }

    case GRADIENT_WALLPAPER_NAME.BLUE: {
      return 0.4
    }

    default: {
      return 0.8
    }
  }
}

export const getPathGradient = (wallpaper: string): string => {
  if (!includes(wallpaper, keys(GRADIENT_WALLPAPER))) {
    return '#f2bc5a,#f76b6b'
  }

  if (wallpaper === GRADIENT_WALLPAPER_NAME.PINK) {
    return '#f8be6d,#c479de'
  }

  if (wallpaper === GRADIENT_WALLPAPER_NAME.GREY) {
    return '#E1D5CC,#955D29'
  }

  // @ts-ignore
  const { colors } = GRADIENT_WALLPAPER[wallpaper]

  if (!colors) return ''

  const color1 = colors[0]
  const color2 = colors[colors.length - 1]

  return `${color1}, ${color2}`
}

export const getUserwallGradientOpacity = (wallpaper: string): number => {
  switch (wallpaper) {
    case GRADIENT_WALLPAPER_NAME.PINK: {
      return 0.2
    }
    case GRADIENT_WALLPAPER_NAME.ORANGE: {
      return 0.15
    }
    case GRADIENT_WALLPAPER_NAME.PURPLE: {
      return 0.16
    }

    default: {
      return 0.35
    }
  }
}

export const getUserwallGradient = (wallpaper: string): string[] => {
  if (includes(wallpaper, [GRADIENT_WALLPAPER_NAME.PURPLE, GRADIENT_WALLPAPER_NAME.ORANGE])) {
    return getPathGradient(wallpaper).split(',').reverse()
  }
  return getPathGradient(wallpaper).split(',')
}

export const getCursorGradient = (wallpaper: string): string => {
  return getPathGradient(wallpaper).split(',')[1]
}

export const getGithubGradient = (wallpaper: string): string => {
  switch (wallpaper) {
    case GRADIENT_WALLPAPER_NAME.PINK: {
      return 'linear-gradient(64deg, #2f2f2f 60%, #211227e0 100%)'
    }

    case GRADIENT_WALLPAPER_NAME.GREEN: {
      return 'linear-gradient(64deg, #2b2b29 60%, #0e230fe0 100%)'
    }

    case GRADIENT_WALLPAPER_NAME.ORANGE: {
      return 'linear-gradient(64deg, #2f2f2f 60%, #271512e0 100%)'
    }

    case GRADIENT_WALLPAPER_NAME.BLUE:
    case GRADIENT_WALLPAPER_NAME.PURPLE: {
      return 'linear-gradient(64deg, #2f2f2f 20%, #0c1d2ee0 100%)'
    }

    case GRADIENT_WALLPAPER_NAME.GREY: {
      return 'linear-gradient(64deg, #2f2f2f 60%, #272524e0 100%)'
    }

    default: {
      return 'linear-gradient(64deg, #2f2f2f 60%, #271512e0 100%)'
    }
  }
}
