import { isEmpty, pick } from 'ramda'
import { useEffect } from 'react'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import useQuery from '~/hooks/useQuery'
import type { TCommunity, TDsbBaseInfoRoute, TEditFunc } from '~/spec'
import type { TDsbFields } from '~/stores/dashboard.domain/spec'
import { BASEINFO_KEYS } from '../../constant'
import S from '../../schema'
import useHelper from '../useHelper'
import useDangerZone, { type TRet as TUseDangerZone } from './useDangerZone'
import useInfo, { type TRet as TUseInfo } from './useInfo'
import useLogos, { type TRet as TUseLogos } from './useLogos'
import useMediaReports, { type TRet as TUseMediaReports } from './useMediaReports'
import useSocialLinks, { type TRet as TUseSocialLinks } from './useSocialLinks'

type TRet = TUseInfo &
  TUseLogos &
  TUseMediaReports &
  TUseSocialLinks &
  TUseDangerZone & {
    loading: boolean
    saving: boolean

    baseInfoTab: TDsbBaseInfoRoute
    edit: TEditFunc
  }

export default (): TRet => {
  const store = useDashboard()

  const curCommunity = useCommunity()
  const { edit } = useHelper()

  const useInfoData = useInfo()
  const useLogosData = useLogos()
  const useMediaReportsData = useMediaReports()
  const useSocialLinksData = useSocialLinks()
  const useDangerZoneData = useDangerZone()

  const { data } = useQuery(S.communityBaseInfo, {
    slug: curCommunity.slug,
    incViews: false,
  })

  const updateBaseInfo = (community: TCommunity): void => {
    const { dashboard } = community
    const { baseInfo, mediaReports } = dashboard

    const updates = BASEINFO_KEYS.reduce((acc, key) => {
      acc[key] = baseInfo[key]
      return acc
    }, {})

    let initMediaReports = []

    if (!isEmpty(mediaReports)) {
      initMediaReports = mediaReports.map((item, index) => ({
        ...item,
        editUrl: item.url,
        index: item.index || index,
      }))
    }

    const original = {
      ...store.original,
      ...updates,
      mediaReports: initMediaReports,
    }

    store.commit({ ...updates, mediaReports: initMediaReports, original: original as TDsbFields })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (data?.community && !store.initFilled) {
      store.commit({ initFilled: true })
      // to avoid hooks rerender which update baseinfo
      updateBaseInfo(data.community)
    }
    return () => store.commit({ initFilled: false })
  }, [
    data,
    store.initFilled,
    store.commit, // to avoid hooks rerender which update baseinfo
  ])

  return {
    edit,
    ...pick(['baseInfoTab', 'loading', 'saving'], store),
    ...useInfoData,
    ...useLogosData,
    ...useSocialLinksData,
    ...useMediaReportsData,
    ...useDangerZoneData,
  }
}
