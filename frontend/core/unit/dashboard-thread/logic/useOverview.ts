import { useEffect } from 'react'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import useQuery from '~/hooks/useQuery'
import type { TCommunity, TOverview } from '~/spec'

import S from '../schema'

export default function useOverview(): TOverview {
  const dsb$ = useDashboard()
  const { slug } = useCommunity()
  const { overview } = dsb$

  const { data } = useQuery(S.communityOverview, {
    slug,
    incViews: false,
  })

  const updateOverview = (community: TCommunity): void => {
    const { meta, views, subscribersCount } = community

    dsb$.commit({
      // @ts-expect-error
      overview: {
        views,
        subscribersCount,
        ...meta,
      },
    })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (data?.community) updateOverview(data.community)
  }, [data])

  return overview
}
