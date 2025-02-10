import { proxy } from 'valtio'

import type { TLocale } from '~/spec'

import { LOCALE } from '~/const/i18n'

import type { TStore } from './spec'

export default (locale: TLocale = LOCALE.EN, localeData = '{}'): TStore => {
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
