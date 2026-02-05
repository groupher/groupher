// this is tmp, use react-i18n .. later

// import { useSearchParams } from 'next/navigation'

import { LOCALE } from '~/const/i18n'
import type { TLocale } from '~/spec'

/**
 * this query is used for GraphQL, which will be intercepted by frontend
 * in short: fake
 */
export const i18nQuery = `
  query($locale: String!) {
    clientI18n(locale: $locale) {
      locale
    }
  }
`

export const useParseLang = (): TLocale => {
  // const searchParams = useSearchParams()

  // return (searchParams.get('lang') || LOCALE.EN) as TLocale
  return LOCALE.EN
}

export const useParseLang2 = (searchParams: URLSearchParams): TLocale => {
  return (searchParams.get('lang') || LOCALE.EN) as TLocale
}

export const loadLocaleFile = (locale: TLocale = LOCALE.EN) => {
  return new Promise((resolve, reject) => {
    switch (locale) {
      case LOCALE.ZH:
        import('~/utils/i18n/zh')
          .then((module) => resolve(module.default))
          .catch((error) => reject(error))
        break
      case LOCALE.EN:
        import('~/utils/i18n/en')
          .then((module) => resolve(module.default))
          .catch((error) => reject(error))
        break
      default:
        reject(new Error(`Unsupported locale: ${locale}`))
    }
  })
}
