import type { TColorName } from '~/spec'

import { upperSnakeCase } from '~/fmt'
import twConfig from '~/const/twConfig.json'

const pageBgColor = twConfig.pageBgColor

// 定义输入类型
type TInputColorScheme = {
  [theme: string]: {
    [colorName: string]: string
  }
}

// 定义输出类型
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

export const PAGE_COLOR_DEFAULT = {
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
