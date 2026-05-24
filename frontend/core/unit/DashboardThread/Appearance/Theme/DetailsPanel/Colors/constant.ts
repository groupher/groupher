import { PRESET_FIELD } from '../../constant'

export const MAIN_COLOR_DETAILS = [
  {
    key: PRESET_FIELD.PRIMARY_COLOR,
    hasContrastRing: false,
    isLarge: true,
    i18nTitleKey: 'dsb.appearance.primary_color.label',
    i18nDescKey: 'dsb.appearance.primary_color.hint',
  },
  {
    key: PRESET_FIELD.ACCENT_COLOR,
    hasContrastRing: false,
    isLarge: false,
    i18nTitleKey: 'dsb.appearance.accent_color.title',
    i18nDescKey: 'dsb.appearance.accent_color.desc',
  },
  {
    key: PRESET_FIELD.TEXT_TITLE,
    hasContrastRing: false,
    isLarge: false,
    i18nTitleKey: 'dsb.appearance.title_color.title',
    i18nDescKey: 'dsb.appearance.title_color.desc',
  },
  {
    key: PRESET_FIELD.TEXT_DIGEST,
    hasContrastRing: false,
    isLarge: false,
    i18nTitleKey: 'dsb.appearance.digest_color.title',
    i18nDescKey: 'dsb.appearance.digest_color.desc',
  },
] as const

export const EXTRA_COLOR_DETAILS = [
  {
    key: PRESET_FIELD.CARD_COLOR,
    hasContrastRing: true,
    isLarge: false,
    i18nTitleKey: 'dsb.appearance.card_color.title',
    i18nDescKey: 'dsb.appearance.card_color.desc',
  },
  {
    key: PRESET_FIELD.DIVIDER_COLOR,
    hasContrastRing: false,
    isLarge: false,
    i18nTitleKey: 'dsb.appearance.divider_color.title',
    i18nDescKey: 'dsb.appearance.divider_color.desc',
  },
] as const

export type TColorDetail = (typeof MAIN_COLOR_DETAILS | typeof EXTRA_COLOR_DETAILS)[number]
