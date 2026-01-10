import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TDsdSEOConf, TEditFunc } from '~/spec'
import { SEO_KEYS } from '../constant'
import useHelper from './useHelper'

type TRet = TDsdSEOConf & {
  edit: TEditFunc
  saving: boolean
  loading: boolean
  isTouched: boolean
  toggleSEO: (seoEnable: boolean) => void
}

export default (): TRet => {
  const dsb$ = useDashboard()
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
