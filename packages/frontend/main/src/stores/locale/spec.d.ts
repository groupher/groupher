import type { TLocale } from '~/spec'

export type TStore = {
  locale: TLocale
  localeData: string

  // actions
  setLocale: (locale: TLocale) => void
  setLocaleData: (localeStr: string) => void
}
