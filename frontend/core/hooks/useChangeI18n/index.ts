import { LOCALE } from '~/const/i18n'
import { loadLocaleFile } from '~/i18n'
import type { TLocale } from '~/spec'
import useLocale from '~/stores/locale/hooks'

type TRet = {
  changeLocale: (locale: TLocale) => void
  locale: TLocale
}

const useChangeI18n = (): TRet => {
  const { locale, setLocale, setLocaleData } = useLocale()

  const changeLocale = (locale: TLocale) => {
    loadLocaleFile(locale)
      .then((localeData) => {
        setLocaleData(JSON.stringify(localeData))
        setLocale(locale)
      })
      .catch((error) => {
        console.log(`## Failed to load locale file: ${error}`)
        if (locale === LOCALE.EN) return

        loadLocaleFile(LOCALE.EN)
          .then((localeData) => {
            setLocaleData(JSON.stringify(localeData))
            setLocale(LOCALE.EN)
          })
          .catch((fallbackError) => {
            console.log(`## Failed to load fallback locale: ${fallbackError}`)
          })
      })
  }

  return {
    locale,
    changeLocale,
  }
}

export default useChangeI18n
