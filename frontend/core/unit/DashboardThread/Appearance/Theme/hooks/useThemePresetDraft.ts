import useDashboard from '~/stores/dashboard/hooks'

import { THEME_PRESET_STORE_FIELDS } from '../constant'
import type { TUseThemePresetDraftRet } from '../spec'

/**
 * ThemePreset semantic wrapper over dashboard draft state.
 *
 * Intent: ThemePreset fields are persisted inside dashboard layout data, so the
 * dashboard store remains the draft/original/touched source of truth. This hook
 * hides the raw field group from Appearance code and exposes the business-level
 * question/action instead.
 *
 * Example:
 *   const { isThemePresetTouched, editThemePresetFields } = useThemePresetDraft()
 *
 *   editThemePresetFields({ themePreset: THEME_PRESET.CUSTOM, themeOverwrite })
 *   if (isThemePresetTouched) saveThemePreset()
 */
export default function useThemePresetDraft(): TUseThemePresetDraftRet {
  const dashboard$ = useDashboard()

  return {
    isThemePresetTouched: dashboard$.anyTouched(THEME_PRESET_STORE_FIELDS),
    editThemePresetFields: dashboard$.editFields,
  }
}
