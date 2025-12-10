import { useCallback, useMemo } from 'react'

import { titleCase } from '~/fmt'
import type { TLocale, TTransKey } from '~/spec'
import useLocale from '~/stores/locale.domain/hooks'

type TFmt = 'titleCase' | null

type TRet = {
  t: (key: TTransKey, fmt?: TFmt) => string
  locale: TLocale
}

const useTrans = (): TRet => {
  const { locale, localeData } = useLocale()

  const localeJson = useMemo(() => JSON.parse(localeData), [localeData])

  const t = useCallback(
    (key: TTransKey, fmt: TFmt = null): string => {
      const ret = localeJson?.[key] || '--'

      if (fmt === 'titleCase') {
        return titleCase(ret)
      }

      return ret
    },
    [localeJson],
  )

  return { t, locale }
}

export default useTrans
