import { useCallback, useEffect, useMemo, useRef } from 'react'

import { LOCALE } from '~/const/i18n'
import { getI18nNamespacesByMetric, loadLocaleFile } from '~/i18n'
import type { TLocale } from '~/spec'
import useLocale from '~/stores/locale/hooks'
import useMetricContext from '~/stores/metric/hooks'

type TRet = {
  changeLocale: (locale: TLocale) => void
  locale: TLocale
}

const useChangeI18n = (): TRet => {
  const { locale, setLocale, setLocaleData } = useLocale()
  const metric = useMetricContext()
  const namespaces = useMemo(() => getI18nNamespacesByMetric(metric), [metric])
  const requestIdRef = useRef(0)

  useEffect(() => {
    requestIdRef.current += 1
  }, [locale, namespaces])

  const changeLocale = useCallback(
    (targetLocale: TLocale) => {
      const requestId = ++requestIdRef.current
      const isCurrentRequest = (): boolean => requestId === requestIdRef.current

      loadLocaleFile(targetLocale, namespaces)
        .then((localeData) => {
          if (!isCurrentRequest()) return
          setLocaleData(JSON.stringify(localeData))
          setLocale(targetLocale)
        })
        .catch((error) => {
          if (!isCurrentRequest()) return
          console.log(`## Failed to load locale file: ${error}`)
          if (targetLocale === LOCALE.EN) return

          loadLocaleFile(LOCALE.EN, namespaces)
            .then((localeData) => {
              if (!isCurrentRequest()) return
              setLocaleData(JSON.stringify(localeData))
              setLocale(LOCALE.EN)
            })
            .catch((fallbackError) => {
              if (!isCurrentRequest()) return
              console.log(`## Failed to load fallback locale: ${fallbackError}`)
            })
        })
    },
    [namespaces, setLocale, setLocaleData],
  )

  return {
    locale,
    changeLocale,
  }
}

export default useChangeI18n
