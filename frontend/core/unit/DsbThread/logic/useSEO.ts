import { pick } from 'ramda'

import type { TDsdSEOConf, TEditFunc } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

import { SEO_KEYS } from '../constant'
import useHelper from './useHelper'

type TRet = TDsdSEOConf & {
  edit: TEditFunc
  saving: boolean
  loading: boolean
  isTouched: boolean
  toggleSEO: (seoEnable: boolean) => void
}

/** Exposes seo state and actions through the shared React hook boundary. */
export default function useSEO(): TRet {
  const dsb$ = useDsb()
  const { edit, anyChanged } = useHelper()

  const isTouched = anyChanged(SEO_KEYS)

  const toggleSEO = (seoEnable: boolean): void => {
    console.log('## toggleSEO: ', seoEnable)
    // sr71$.mutate(S.updateDashboardSeo, { community: curCommunity.slug, seoEnable })
  }

  return {
    edit,
    ...pick(SEO_KEYS, dsb$),
    ...pick(['loading', 'saving'], dsb$),
    isTouched,
    toggleSEO,
  }
}
