import { useCallback, useMemo } from 'react'

import { titleCase } from '~/fmt'

import useSubStore from '~/hooks/useSubStore'
import type { TLocale, TTransKey } from '~/spec'

type TFmt = 'titleCase' | null

type TRet = {
  t: (key: TTransKey, fmt?: TFmt) => string
  locale: TLocale
}

const useTrans = (): TRet => {
  const { locale, localeData } = useSubStore('locale')

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
