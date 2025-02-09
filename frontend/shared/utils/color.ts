import type { TColorName } from '~/spec'
import { COLOR_NAME } from '~/const/colors'

/* eslint-disable radix */
/**
 * for lighten / darken color
 * see https://stackoverflow.com/a/13532993/4050784
 */
const shadeColor = (color: string, percent: number): string => {
  let R = Number.parseInt(color.substring(1, 3), 16)
  let G = Number.parseInt(color.substring(3, 5), 16)
  let B = Number.parseInt(color.substring(5, 7), 16)

  // @ts-ignore
  R = Number.parseInt((R * (100 + percent)) / 100)
  // @ts-ignore
  G = Number.parseInt((G * (100 + percent)) / 100)
  // @ts-ignore
  B = Number.parseInt((B * (100 + percent)) / 100)

  R = R < 255 ? R : 255
  G = G < 255 ? G : 255
  B = B < 255 ? B : 255

  const RR = R.toString(16).length === 1 ? `0${R.toString(16)}` : R.toString(16)
  const GG = G.toString(16).length === 1 ? `0${G.toString(16)}` : G.toString(16)
  const BB = B.toString(16).length === 1 ? `0${B.toString(16)}` : B.toString(16)

  return `#${RR}${GG}${BB}`
}

export const lighten = (color: string, percent: number): string => {
  return shadeColor(color, percent as number)
}

export const darken = (color: string, percent: number): string => {
  return shadeColor(color, -percent as number)
}

export const getLetterColor = (username: string): TColorName => {
  const firstLetter = username[0].toLowerCase()

  switch (firstLetter) {
    case 'a':
    case 'b':
    case 'c': {
      return COLOR_NAME.RED
    }

    case 'd':
    case 'e':
    case 'f': {
      return COLOR_NAME.YELLOW
    }

    case 'g':
    case 'h':
    case 'i': {
      return COLOR_NAME.GREEN
    }

    case 'j':
    case 'k':
    case 'l': {
      return COLOR_NAME.BLUE
    }

    case 'm':
    case 'n':
    case 'o': {
      return COLOR_NAME.PURPLE
    }

    case 'p':
    case 'q':
    case 'r': {
      return COLOR_NAME.CYAN
    }
    case 's':
    case 't':
    case 'w':
    case 'u': {
      return COLOR_NAME.PURPLE
    }

    case 'x':
    case 'y':
    case 'z': {
      return COLOR_NAME.CYAN
    }

    default: {
      return COLOR_NAME.PURPLE
    }
  }
}
