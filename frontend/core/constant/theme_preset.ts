import { COLOR, PAGE_BG_COLOR_HEX } from '~/const/colors'
import THEME from '~/const/theme'
import { getPageBgCustomParamsFromHex } from '~/lib/color'

export const THEME_PRESET = {
  DEFAULT: 'DEFAULT',
  CLAUDE: 'CLAUDE',
  SOLARIZED: 'SOLARIZED',
  HN: 'HN',
  CUSTOM: 'CUSTOM',
} as const

export const DEFAULT_THEME_PRESET = THEME_PRESET.DEFAULT

const EMPTY_CUSTOM_PRIMARY = {
  primaryCustomColor: '',
  primaryCustomColorDark: '',
} as const

// Keep custom accent keys present in every preset overwrite. Most presets
// use a built-in accent color today, but the resolved preset shape still
// needs stable custom token fields for SSR, CSS vars, and future custom input.
const EMPTY_CUSTOM_ACCENT = {
  accentCustomColor: '',
  accentCustomColorDark: '',
} as const

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

const pageBgOverwrite = (
  lightBg: keyof typeof PAGE_BG_COLOR_HEX,
  darkBg: keyof typeof PAGE_BG_COLOR_HEX,
) => {
  const light = getPageBgCustomParamsFromHex(PAGE_BG_COLOR_HEX[lightBg], THEME.LIGHT)
  const dark = getPageBgCustomParamsFromHex(PAGE_BG_COLOR_HEX[darkBg], THEME.DARK)

  return {
    pageBg: COLOR.CUSTOM,
    pageBgDark: COLOR.CUSTOM,
    pageCustomBg: light.hue,
    pageCustomBgDark: dark.hue,
    pageCustomIntensity: light.intensity,
    pageCustomIntensityDark: dark.intensity,
  } as const
}

export const THEME_PRESET_OPTIONS = [
  {
    value: THEME_PRESET.DEFAULT,
    overwrite: {
      ...pageBgOverwrite('pure white', 'outer space'),
      primaryColor: COLOR.PURPLE,
      ...EMPTY_CUSTOM_PRIMARY,
      accentColor: COLOR.BLUE,
      ...EMPTY_CUSTOM_ACCENT,
      textTitle: DEFAULT_TEXT_TITLE,
      textDigest: DEFAULT_TEXT_DIGEST,
      ...DEFAULT_GAUSS_BLUR,
      ...DEFAULT_GLOW,
    },
  },
  {
    value: THEME_PRESET.CLAUDE,
    overwrite: {
      ...pageBgOverwrite('floral white', 'coffee bean'),
      primaryColor: COLOR.CUSTOM,
      primaryCustomColor: '#c96442',
      primaryCustomColorDark: '#d97757',
      accentColor: COLOR.BLUE,
      ...EMPTY_CUSTOM_ACCENT,
      textTitle: '#2f2a24',
      textDigest: '#786f63',
      ...DEFAULT_GAUSS_BLUR,
      ...DEFAULT_GLOW,
    },
  },
  {
    value: THEME_PRESET.SOLARIZED,
    overwrite: {
      ...pageBgOverwrite('solarized', 'solarized dark'),
      primaryColor: COLOR.CUSTOM,
      primaryCustomColor: '#859900',
      primaryCustomColorDark: '#b6c65b',
      accentColor: COLOR.BLUE,
      ...EMPTY_CUSTOM_ACCENT,
      textTitle: '#073642',
      textDigest: '#657b83',
      ...DEFAULT_GAUSS_BLUR,
      ...DEFAULT_GLOW,
    },
  },
  {
    value: THEME_PRESET.HN,
    overwrite: {
      ...pageBgOverwrite('hacker news', 'black chocolate'),
      primaryColor: COLOR.BLACK,
      ...EMPTY_CUSTOM_PRIMARY,
      accentColor: COLOR.BLUE,
      ...EMPTY_CUSTOM_ACCENT,
      textTitle: '#222222',
      textDigest: '#666666',
      ...DEFAULT_GAUSS_BLUR,
      ...DEFAULT_GLOW,
    },
  },
] as const
