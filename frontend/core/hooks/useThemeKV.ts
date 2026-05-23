import { useMemo } from 'react'

import { createThemeKeyPicker } from '~/lib/themeKey'

import useTheme from './useTheme'

/**
 * Resolve `xx / xxDark` keys and values for the current theme.
 *
 * Intent: components should read the current theme once, then pass base keys
 * only. This works for any object that follows the paired key convention.
 *
 * Example:
 *   const { theme, key, value } = useThemeKV()
 *   const colorKey = key('cardColor')
 *   const color = value(source, 'cardColor')
 */
export default function useThemeKV() {
  const { theme } = useTheme()

  return useMemo(() => createThemeKeyPicker(theme), [theme])
}
