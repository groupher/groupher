import THEME from '~/const/theme'
import {
  DEFAULT_TEXT_DIGEST,
  DEFAULT_TEXT_DIGEST_DARK,
  DEFAULT_TEXT_TITLE,
  DEFAULT_TEXT_TITLE_DARK,
} from '~/const/theme_preset'
import type { TThemePreset } from '~/spec'

export const THEME_PRESET_FIELD_KEYS = [
  'pageBg',
  'pageBgDark',
  'primaryColor',
  'primaryColorDark',
  'accentColor',
  'accentColorDark',
  'textTitle',
  'textTitleDark',
  'textDigest',
  'textDigestDark',
  'gaussBlur',
  'gaussBlurDark',
  'glowType',
  'glowTypeDark',
  'glowFixed',
  'glowOpacity',
  'glowOpacityDark',
] as const

export type TThemePresetField = (typeof THEME_PRESET_FIELD_KEYS)[number]

export type TResolvedThemePreset = {
  pageBg: string
  pageBgDark: string
  primaryColor: string
  primaryColorDark: string
  accentColor: string
  accentColorDark: string
  textTitle: string
  textTitleDark: string
  textDigest: string
  textDigestDark: string
  gaussBlur: number
  gaussBlurDark: number
  glowType: string
  glowTypeDark: string
  glowFixed: boolean
  glowOpacity: number
  glowOpacityDark: number
}

export type TThemePresetSource = Partial<TResolvedThemePreset> & {
  themePreset?: TThemePreset | string
  themePresetBase?: TThemePreset | string
  themeTokens?: Record<string, unknown> | null
}

export type TThemePresetCssVars = Record<`--${string}`, string>
type TThemePresetCssSource = Pick<
  TResolvedThemePreset,
  | 'pageBg'
  | 'pageBgDark'
  | 'primaryColor'
  | 'primaryColorDark'
  | 'accentColor'
  | 'accentColorDark'
  | 'textTitle'
  | 'textTitleDark'
  | 'textDigest'
  | 'textDigestDark'
>

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i
const FALLBACK_PAGE_BG = '#fffcfc'
const FALLBACK_PAGE_BG_DARK = '#25161d'

const FALLBACK_THEME_PRESET: TResolvedThemePreset = {
  pageBg: FALLBACK_PAGE_BG,
  pageBgDark: FALLBACK_PAGE_BG_DARK,
  primaryColor: '#333333',
  primaryColorDark: '#ffffff',
  accentColor: '#333333',
  accentColorDark: '#ffffff',
  textTitle: DEFAULT_TEXT_TITLE,
  textTitleDark: DEFAULT_TEXT_TITLE_DARK,
  textDigest: DEFAULT_TEXT_DIGEST,
  textDigestDark: DEFAULT_TEXT_DIGEST_DARK,
  gaussBlur: 100,
  gaussBlurDark: 100,
  glowType: '',
  glowTypeDark: '',
  glowFixed: true,
  glowOpacity: 100,
  glowOpacityDark: 100,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const resolveThemePresetColor = (value: string | undefined, fallback: string): string => {
  if (value && HEX_COLOR_RE.test(value)) return value
  return fallback
}

export const pickThemePresetFields = (source: Partial<TResolvedThemePreset>) => {
  const patch = {} as Partial<TResolvedThemePreset>

  for (const key of THEME_PRESET_FIELD_KEYS) {
    if (source[key] !== undefined && source[key] !== null) {
      patch[key] = source[key] as never
    }
  }

  return patch
}

export const normalizeThemeTokenSource = (
  source: Record<string, unknown> | Partial<TResolvedThemePreset> | null | undefined,
): Partial<TResolvedThemePreset> => {
  if (!isRecord(source)) return {}

  return source as Partial<TResolvedThemePreset>
}

export const pickResolvedThemePresetFields = (source: TResolvedThemePreset): TResolvedThemePreset =>
  pickThemePresetFields(source) as TResolvedThemePreset

export const resolveThemePresetPageBgCssVar = (
  theme: typeof THEME.LIGHT | typeof THEME.DARK,
  pageBg: string | undefined,
): string => {
  const fallbackBg = theme === THEME.LIGHT ? FALLBACK_PAGE_BG : FALLBACK_PAGE_BG_DARK

  return resolveThemePresetColor(pageBg, fallbackBg)
}

export const buildThemePresetCssVars = (
  themePreset: TThemePresetCssSource,
  isLightTheme: boolean,
): TThemePresetCssVars => {
  const safeTextTitle = resolveThemePresetColor(themePreset.textTitle, DEFAULT_TEXT_TITLE)
  const safeTextTitleDark = resolveThemePresetColor(
    themePreset.textTitleDark,
    DEFAULT_TEXT_TITLE_DARK,
  )
  const safeTextDigest = resolveThemePresetColor(themePreset.textDigest, DEFAULT_TEXT_DIGEST)
  const safeTextDigestDark = resolveThemePresetColor(
    themePreset.textDigestDark,
    DEFAULT_TEXT_DIGEST_DARK,
  )

  return {
    '--color-primary-custom': resolveThemePresetColor(themePreset.primaryColor, '#333333'),
    '--color-primary-custom-dark': resolveThemePresetColor(themePreset.primaryColorDark, '#ffffff'),
    '--color-accent-custom': resolveThemePresetColor(themePreset.accentColor, '#333333'),
    '--color-accent-custom-dark': resolveThemePresetColor(themePreset.accentColorDark, '#ffffff'),
    '--color-page-custom': resolveThemePresetPageBgCssVar(THEME.LIGHT, themePreset.pageBg),
    '--color-page-custom-dark': resolveThemePresetPageBgCssVar(THEME.DARK, themePreset.pageBgDark),
    '--color-title': isLightTheme ? safeTextTitle : safeTextTitleDark,
    '--color-title-dark': safeTextTitleDark,
    '--color-digest': isLightTheme ? safeTextDigest : safeTextDigestDark,
    '--color-digest-dark': safeTextDigestDark,
  }
}

export const buildThemePresetDarkCssVars = (
  themePreset: TResolvedThemePreset,
): Pick<TThemePresetCssVars, '--color-title' | '--color-digest'> => ({
  '--color-title': resolveThemePresetColor(themePreset.textTitleDark, DEFAULT_TEXT_TITLE_DARK),
  '--color-digest': resolveThemePresetColor(themePreset.textDigestDark, DEFAULT_TEXT_DIGEST_DARK),
})

/**
 * Resolve effective theme values from backend/dashboard layout data.
 * The backend owns preset defaults and returns the resolved `themeTokens`
 * payload for both built-in and custom presets.
 */
export const resolveThemePreset = (source: TThemePresetSource = {}): TResolvedThemePreset => {
  const backendTokens = normalizeThemeTokenSource(source.themeTokens)
  const flatTokens = pickThemePresetFields(source)
  const tokenPayload = pickThemePresetFields(backendTokens as Partial<TResolvedThemePreset>)

  return {
    ...FALLBACK_THEME_PRESET,
    ...flatTokens,
    ...tokenPayload,
  }
}
