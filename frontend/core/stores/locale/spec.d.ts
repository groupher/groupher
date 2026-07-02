import type { TLocale } from '~/spec'

export type TInit = {
  locale: TLocale
  localeData: string
}
export type TStore = TInit & {
  // actions
  setLocale: (locale: TLocale) => void
  setLocaleData: (localeStr: string) => void
}
