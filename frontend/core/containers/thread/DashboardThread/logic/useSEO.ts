import { pick } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import type { TDashboardSEORoute, TDsdSEOConf, TEditFunc } from '~/spec'
import { SEO_KEYS } from '../constant'
import useHelper from './useHelper'

type TRet = TDsdSEOConf & {
  edit: TEditFunc
  saving: boolean
  seoTab: TDashboardSEORoute
  loading: boolean
  isTouched: boolean
  toggleSEO: (seoEnable: boolean) => void
}

export default (): TRet => {
  const store = useDashboard()
  const { edit, anyChanged } = useHelper()

  const isTouched = anyChanged(SEO_KEYS)

  const toggleSEO = (seoEnable: boolean): void => {
    // const { curCommunity } = store

    console.log('## toggleSEO: ', seoEnable)
    // sr71$.mutate(S.updateDashboardSeo, { community: curCommunity.slug, seoEnable })
  }

  return {
    edit,
    ...pick(SEO_KEYS, store),
    ...pick(['seoTab', 'loading', 'saving'], store),
    isTouched,
    toggleSEO,
  }
}
