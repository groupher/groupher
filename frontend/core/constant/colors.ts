import twConfig from '~/const/twConfig.json'

import { upperSnakeCase } from '~/fmt'
import type { TColorName } from '~/spec'

/** TODO: 把这些颜色移动到 token/colors 去，配合选择器同时d定制 title/digest/card 的颜色 */
const pageBgColor = twConfig.pageBgColor

type TInputColorScheme = {
  [theme: string]: {
    [colorName: string]: string
  }
}

type TOutputColorScheme = {
  [theme: string]: {
    [colorName: string]: string
  }
}

const generatePageBgColor = (input: TInputColorScheme): TOutputColorScheme => {
  const output: TOutputColorScheme = {}

  for (const [theme, colors] of Object.entries(input)) {
    output[theme] = {}
    for (const [colorName, colorValue] of Object.entries(colors)) {
      const upperSnakeCaseKey = upperSnakeCase(colorName)
      output[theme][upperSnakeCaseKey] = colorValue
    }
  }

  return output
}

export const CONTAINER_BG_DEFAULT = {
  light: 'PURE_WHITE',
  dark: 'OUTER_SPACE',
}

export const PAGE_COLOR = generatePageBgColor({
  light: pageBgColor.light,
  dark: pageBgColor.dark,
})

export const COLOR_NAME = {
  BLACK: 'BLACK',
  PINK: 'PINK',
  RED: 'RED',
  ORANGE: 'ORANGE',
  YELLOW: 'YELLOW',
  BROWN: 'BROWN',
  GREEN_LIGHT: 'GREEN_LIGHT',
  GREEN: 'GREEN',
  CYAN: 'CYAN',
  CYAN_LIGHT: 'CYAN_LIGHT',
  BLUE: 'BLUE',
  PURPLE: 'PURPLE',
} as Record<TColorName, TColorName>
