import { proxy } from 'valtio'

import { LOCALE } from '~/const/i18n'
import type { TLocale } from '~/spec'

import type { TInit, TStore } from './spec'

export default function Locale({ locale = LOCALE.EN, localeData = '{}' }: TInit): TStore {
  const store = proxy({
    locale,
    localeData,

    // actions
    setLocale: (locale: TLocale): void => {
      store.locale = locale
    },
    setLocaleData: (localeStr: string): void => {
      store.localeData = localeStr
    },
  })

  return store
}
