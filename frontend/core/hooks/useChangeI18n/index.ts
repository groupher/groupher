import useLocale from '~/hooks/useLocale'
import { loadLocaleFile, setTransLocale } from '~/i18n'
import type { TLocale } from '~/spec'

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
        setTransLocale(locale)
      })
      .catch((error) => {
        console.log(`## Failed to load locale file: ${error}`)
      })
  }

  return {
    locale,
    changeLocale,
  }
}

export default useChangeI18n
