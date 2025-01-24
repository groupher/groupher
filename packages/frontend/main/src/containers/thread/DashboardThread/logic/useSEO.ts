import { useCallback } from 'react'
import { pick } from 'ramda'

import type { TDashboardSEOConfig, TDashboardSEORoute, TEditFunc } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'
import { SEO_KEYS } from '../constant'

type TRet = TDashboardSEOConfig & {
  edit: TEditFunc
  saving: boolean
  seoTab: TDashboardSEORoute
  loading: boolean
  getIsTouched: () => boolean
  toggleSEO: (seoEnable: boolean) => void
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { edit, anyChanged } = useHelper()

  // drived
  // @ts-ignorei
  const getIsTouched = useCallback(() => anyChanged(SEO_KEYS), [store])

  const toggleSEO = (seoEnable: boolean): void => {
    // const { curCommunity } = store

    console.log('## toggleSEO: ', seoEnable)
    // sr71$.mutate(S.updateDashboardSeo, { community: curCommunity.slug, seoEnable })
  }

  return {
    edit,
    ...pick(SEO_KEYS, store),
    ...pick(['seoTab', 'loading', 'saving'], store),
    getIsTouched,
    toggleSEO,
  }
}
