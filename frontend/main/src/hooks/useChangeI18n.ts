import type { TLocale } from '~/spec'
import { loadLocaleFile } from '~/i18n'
import useSubStore from '~/hooks/useSubStore'

type TRet = {
  changeLocale: (locale: TLocale) => void
  locale: TLocale
}

const useChangeI18n = (): TRet => {
  const { locale, setLocale, setLocaleData } = useSubStore('locale')

  const changeLocale = (locale: TLocale) => {
    loadLocaleFile(locale)
      .then((localeData) => {
        setLocaleData(JSON.stringify(localeData))
        setLocale(locale)
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
