import { proxy } from 'valtio'

import { LOCALE } from '~/const/i18n'
import type { TLocale } from '~/spec'

import type { TInit, TStore } from './spec'

/** Creates an isolated reactive locale store for the active locale and translation payload. */
export default function createLocaleStore({
  locale = LOCALE.EN,
  localeData = '{}',
  routeOverride = false,
}: TInit): TStore {
  const store = proxy({
    locale,
    localeData,
    routeOverride,

    // actions
    setLocale: (locale: TLocale): void => {
      store.locale = locale
    },
    setLocaleData: (localeStr: string): void => {
      store.localeData = localeStr
    },
    setRouteOverride: (value: boolean): void => {
      store.routeOverride = value
    },
  })

  return store
}
