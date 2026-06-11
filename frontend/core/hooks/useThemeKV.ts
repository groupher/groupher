import { useMemo } from 'react'

import THEME from '~/const/theme'
import type { TResolvedThemePreset, TThemePresetThemeTokens } from '~/spec'

import useTheme from './useTheme'

/**
 * Read and patch the active light/dark theme section.
 *
 * Intent: ThemePreset data is physically split into `light` and `dark`
 * sections. Components should select one section, not synthesize old `Dark`
 * suffix keys at runtime.
 *
 * Example:
 *   const { theme, section, value, patch } = useThemeKV()
 *   const color = value(tokens, 'cardColor')
 *   onCommit(patch({ cardColor: '#ffffff' }))
 */
export default function useThemeKV() {
  const { theme } = useTheme()
  const section = theme === THEME.DARK ? 'dark' : 'light'

  return useMemo(
    () => ({
      theme,
      section,
      value: <TKey extends keyof TThemePresetThemeTokens>(
        tokens: Pick<TResolvedThemePreset, typeof section>,
        key: TKey,
      ): TThemePresetThemeTokens[TKey] => tokens[section][key],
      patch: (patch: Partial<TThemePresetThemeTokens>) => ({
        [section]: patch,
      }),
    }),
    [section, theme],
  )
}
