import { useCallback, useMemo } from 'react'

import { titleCase } from '~/fmt'
import type { TLocale, TTransKey } from '~/spec'
import { useExtraLocaleContext } from '~/stores/locale/extra-context'
import useLocale from '~/stores/locale/hooks'

type TFmt = 'titleCase' | null
type TParams = Record<string, string | number>

type TRet = {
  t: (key: TTransKey, fmtOrParams?: TFmt | TParams) => string
  locale: TLocale
}

const useTrans = (): TRet => {
  const { locale, localeData } = useLocale()
  const extraLocaleData = useExtraLocaleContext()

  const localeJson = useMemo(
    () => ({
      ...JSON.parse(localeData),
      ...extraLocaleData,
    }),
    [localeData, extraLocaleData],
  )

  const t = useCallback(
    (key: TTransKey, fmtOrParams: TFmt | TParams = null): string => {
      let ret = localeJson?.[key] || '--'

      if (typeof fmtOrParams === 'object' && fmtOrParams !== null) {
        ret = ret.replace(/\{(\w+)\}/g, (_, name: string) => String(fmtOrParams[name] ?? ''))
      }

      if (fmtOrParams === 'titleCase') {
        return titleCase(ret)
      }

      return ret
    },
    [localeJson],
  )

  return { t, locale }
}

export default useTrans
