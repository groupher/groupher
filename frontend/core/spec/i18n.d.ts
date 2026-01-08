import type { LOCALE } from '~/const/i18n'
import type langJson from '~/i18n/en'
import type { TConstValues } from '~/spec'

export type TLocale = TConstValues<typeof LOCALE>

export type TTransKey = keyof typeof langJson
