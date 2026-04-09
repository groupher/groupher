import { LOCALE } from '~/const/i18n'
import { getI18nNamespacesByMetric, loadLocaleFile } from '~/i18n'
import type { TLocale } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'
import useLocale from '~/stores/locale/hooks'

type TRet = {
  changeLocale: (locale: TLocale) => void
  locale: TLocale
}

const useChangeI18n = (): TRet => {
  const { locale, setLocale, setLocaleData } = useLocale()
  const { metric } = useDashboard()
  const namespaces = getI18nNamespacesByMetric(metric)

  const changeLocale = (locale: TLocale) => {
    loadLocaleFile(locale, namespaces)
      .then((localeData) => {
        setLocaleData(JSON.stringify(localeData))
        setLocale(locale)
      })
      .catch((error) => {
        console.log(`## Failed to load locale file: ${error}`)
        if (locale === LOCALE.EN) return

        loadLocaleFile(LOCALE.EN, namespaces)
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
