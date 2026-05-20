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

// Keep custom sub-primary keys present in every preset override. Most presets
// use a built-in sub-primary color today, but the resolved preset shape still
// needs stable custom token fields for SSR, CSS vars, and future custom input.
const EMPTY_CUSTOM_SUB_PRIMARY = {
  subPrimaryCustomColor: '',
  subPrimaryCustomColorDark: '',
} as const

export const DEFAULT_TEXT_TITLE = '#243041'
export const DEFAULT_TEXT_DIGEST = '#6b7280'

const pageBgOverrides = (
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
    overrides: {
      ...pageBgOverrides('pure white', 'outer space'),
      primaryColor: COLOR.PURPLE,
      ...EMPTY_CUSTOM_PRIMARY,
      subPrimaryColor: COLOR.BLUE,
      ...EMPTY_CUSTOM_SUB_PRIMARY,
      textTitle: DEFAULT_TEXT_TITLE,
      textDigest: DEFAULT_TEXT_DIGEST,
    },
  },
  {
    value: THEME_PRESET.CLAUDE,
    overrides: {
      ...pageBgOverrides('floral white', 'coffee bean'),
      primaryColor: COLOR.CUSTOM,
      primaryCustomColor: '#c96442',
      primaryCustomColorDark: '#d97757',
      subPrimaryColor: COLOR.BLUE,
      ...EMPTY_CUSTOM_SUB_PRIMARY,
      textTitle: '#2f2a24',
      textDigest: '#786f63',
    },
  },
  {
    value: THEME_PRESET.SOLARIZED,
    overrides: {
      ...pageBgOverrides('solarized', 'solarized dark'),
      primaryColor: COLOR.CUSTOM,
      primaryCustomColor: '#859900',
      primaryCustomColorDark: '#b6c65b',
      subPrimaryColor: COLOR.BLUE,
      ...EMPTY_CUSTOM_SUB_PRIMARY,
      textTitle: '#073642',
      textDigest: '#657b83',
    },
  },
  {
    value: THEME_PRESET.HN,
    overrides: {
      ...pageBgOverrides('hacker news', 'black chocolate'),
      primaryColor: COLOR.BLACK,
      ...EMPTY_CUSTOM_PRIMARY,
      subPrimaryColor: COLOR.BLUE,
      ...EMPTY_CUSTOM_SUB_PRIMARY,
      textTitle: '#222222',
      textDigest: '#666666',
    },
  },
] as const
