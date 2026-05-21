import { COLOR, RAINBOW_COLOR_HEX } from '~/const/colors'
import THEME from '~/const/theme'
import { getPageBgCustomColor } from '~/lib/color'

export const THEME_PRESET = {
  DEFAULT: 'DEFAULT',
  CLAUDE: 'CLAUDE',
  SOLARIZED: 'SOLARIZED',
  HN: 'HN',
  CUSTOM: 'CUSTOM',
} as const

export const DEFAULT_THEME_PRESET = THEME_PRESET.DEFAULT

const DEFAULT_GAUSS_BLUR = {
  gaussBlur: 100,
  gaussBlurDark: 100,
} as const

const DEFAULT_GLOW = {
  glowType: '',
  glowTypeDark: '',
  glowFixed: true,
  glowOpacity: 100,
  glowOpacityDark: 100,
} as const

export const DEFAULT_TEXT_TITLE = '#243041'
export const DEFAULT_TEXT_DIGEST = '#6b7280'

const pageBgColorsFromControl = (
  lightHue: number,
  lightIntensity: number,
  darkHue: number,
  darkIntensity: number,
) =>
  ({
    pageBg: getPageBgCustomColor(THEME.LIGHT, lightHue, lightIntensity),
    pageBgDark: getPageBgCustomColor(THEME.DARK, darkHue, darkIntensity),
  }) as const

export const THEME_PRESET_OPTIONS = [
  {
    value: THEME_PRESET.DEFAULT,
    overwrite: {
      ...pageBgColorsFromControl(0, 0, 0, 15),
      primaryColor: RAINBOW_COLOR_HEX[THEME.LIGHT][COLOR.PURPLE],
      primaryColorDark: RAINBOW_COLOR_HEX[THEME.DARK][COLOR.PURPLE],
      accentColor: RAINBOW_COLOR_HEX[THEME.LIGHT][COLOR.BLUE],
      accentColorDark: RAINBOW_COLOR_HEX[THEME.DARK][COLOR.BLUE],
      textTitle: DEFAULT_TEXT_TITLE,
      textDigest: DEFAULT_TEXT_DIGEST,
      ...DEFAULT_GAUSS_BLUR,
      ...DEFAULT_GLOW,
    },
  },
  {
    value: THEME_PRESET.CLAUDE,
    overwrite: {
      ...pageBgColorsFromControl(40, 49, 0, 0),
      primaryColor: '#c96442',
      primaryColorDark: '#d97757',
      accentColor: RAINBOW_COLOR_HEX[THEME.LIGHT][COLOR.BLUE],
      accentColorDark: RAINBOW_COLOR_HEX[THEME.DARK][COLOR.BLUE],
      textTitle: '#2f2a24',
      textDigest: '#786f63',
      ...DEFAULT_GAUSS_BLUR,
      ...DEFAULT_GLOW,
    },
  },
  {
    value: THEME_PRESET.SOLARIZED,
    overwrite: {
      ...pageBgColorsFromControl(42, 97, 191, 18),
      primaryColor: '#859900',
      primaryColorDark: '#b6c65b',
      accentColor: RAINBOW_COLOR_HEX[THEME.LIGHT][COLOR.BLUE],
      accentColorDark: RAINBOW_COLOR_HEX[THEME.DARK][COLOR.BLUE],
      textTitle: '#073642',
      textDigest: '#657b83',
      ...DEFAULT_GAUSS_BLUR,
      ...DEFAULT_GLOW,
    },
  },
  {
    value: THEME_PRESET.HN,
    overwrite: {
      ...pageBgColorsFromControl(60, 54, 38, 0),
      primaryColor: RAINBOW_COLOR_HEX[THEME.LIGHT][COLOR.BLACK],
      primaryColorDark: RAINBOW_COLOR_HEX[THEME.DARK][COLOR.BLACK],
      accentColor: RAINBOW_COLOR_HEX[THEME.LIGHT][COLOR.BLUE],
      accentColorDark: RAINBOW_COLOR_HEX[THEME.DARK][COLOR.BLUE],
      textTitle: '#222222',
      textDigest: '#666666',
      ...DEFAULT_GAUSS_BLUR,
      ...DEFAULT_GLOW,
    },
  },
] as const
