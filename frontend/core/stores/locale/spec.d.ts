import type { TLocale } from '~/spec'

export type TInit = {
  locale: TLocale
  localeData: string
  routeOverride?: boolean
}
export type TStore = TInit & {
  routeOverride: boolean
  // actions
  setLocale: (locale: TLocale) => void
  setLocaleData: (localeStr: string) => void
  setRouteOverride: (routeOverride: boolean) => void
}
