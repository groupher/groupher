'use client'

import type { TColorName } from '~/spec'
import useThemePreset from '~/stores/ThemePreset/hooks'

export default function usePrimaryColor(): TColorName {
  const preset$ = useThemePreset()

  return preset$.primaryColor
}
