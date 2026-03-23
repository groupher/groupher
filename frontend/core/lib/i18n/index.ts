import { LOCALE } from '~/const/i18n'
import type { TLocale } from '~/spec'

const loaders: Record<TLocale, () => Promise<any>> = {
  [LOCALE.EN]: () => import('~/utils/i18n/en').then((m) => m.default),
  [LOCALE.ZH]: () => import('~/utils/i18n/zh').then((m) => m.default),
  [LOCALE['ZH-HANT']]: () => import('~/utils/i18n/zh').then((m) => m.default),
  [LOCALE.RU]: () => import('~/utils/i18n/en').then((m) => m.default),
  [LOCALE.ES]: () => import('~/utils/i18n/en').then((m) => m.default),
} as const

export function loadLocaleFile(locale: TLocale = LOCALE.EN) {
  const loader = loaders[locale]
  if (!loader) throw new Error(`Unsupported locale: ${locale}`)
  return loader()
}
