import { PRESET_FIELD } from '~/const/theme_preset'
import type { TDsbStoreFieldKey } from '~/stores/dashboard/spec'

export { PRESET_FIELD }

export const THEME_PRESET_STORE_FIELDS = [
  PRESET_FIELD.THEME_PRESET,
  PRESET_FIELD.THEME_PRESET_BASE,
  PRESET_FIELD.THEME_TOKENS,
  PRESET_FIELD.HAS_CUSTOM_THEME_PRESET,
] as const satisfies readonly TDsbStoreFieldKey[]

export const PREVIEW_CSS_VAR_CLEANUP = {
  '--preview-page-bg': null,
  '--preview-glow-opacity': null,
} as const
