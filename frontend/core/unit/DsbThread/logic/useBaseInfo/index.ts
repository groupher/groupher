import type { ResultOf } from '@graphql-typed-document-node/core'
import { useQuery } from '@tanstack/react-query'
import { isEmpty, pick } from 'ramda'
import { useEffect } from 'react'

import { graphqlQueryOptions } from '~/query'
import type { TEditFunc } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDsb from '~/stores/dsb/hooks'
import type { TDsbFieldMap } from '~/stores/dsb/spec'
import S from '~/unit/DsbThread/schema/shell'

import { BASEINFO_KEYS } from '../../constant'
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

type TCommunityBaseInfo = NonNullable<ResultOf<typeof S.communityBaseInfo>['community']>

/** Exposes base info state and actions through the shared React hook boundary. */
export default function useBaseInfo(): TRet {
  const dsb$ = useDsb()
  const { slug } = useCommunity()
  const { edit } = useHelper()

  const useInfoData = useInfo()
  const useLogosData = useLogos()
  const useMediaReportsData = useMediaReports()
  const useSocialLinksData = useSocialLinks()
  const useDangerZoneData = useDangerZone()

  const { data } = useQuery(graphqlQueryOptions(S.communityBaseInfo, { slug, incViews: false }))

  const updateBaseInfo = (community: TCommunityBaseInfo): void => {
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
