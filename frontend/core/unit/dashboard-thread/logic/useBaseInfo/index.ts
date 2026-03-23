import { isEmpty, pick } from 'ramda'
import { useEffect } from 'react'
import useQuery from '~/hooks/useQuery'
import type { TCommunity, TEditFunc } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import type { TDsbFieldMap } from '~/stores/dashboard/spec'
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
    edit: TEditFunc
  }

export default function useBaseInfo(): TRet {
  const dsb$ = useDashboard()
  const { slug } = useCommunity()
  const { edit } = useHelper()

  const useInfoData = useInfo()
  const useLogosData = useLogos()
  const useMediaReportsData = useMediaReports()
  const useSocialLinksData = useSocialLinks()
  const useDangerZoneData = useDangerZone()

  const { data } = useQuery(S.communityBaseInfo, {
    slug,
    incViews: false,
  })

  const updateBaseInfo = (community: TCommunity): void => {
    const { dashboard: dashboard$ } = community
    const { baseInfo, mediaReports } = dashboard$

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
      ...dsb$.original,
      ...updates,
      mediaReports: initMediaReports,
    }

    dsb$.commit({
      ...updates,
      mediaReports: initMediaReports,
      original: original as TDsbFieldMap,
    })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (data?.community && !dsb$.initFilled) {
      dsb$.commit({ initFilled: true })
      // to avoid hooks rerender which update baseinfo
      updateBaseInfo(data.community)
    }
  }, [dsb$.initFilled])

  return {
    edit,
    ...pick(['loading', 'saving'], dsb$),
    ...useInfoData,
    ...useLogosData,
    ...useSocialLinksData,
    ...useMediaReportsData,
    ...useDangerZoneData,
  }
}
