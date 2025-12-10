import { useEffect } from 'react'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import useQuery from '~/hooks/useQuery'
import type { TCommunity, TOverview } from '~/spec'

import S from '../schema'

export default (): TOverview => {
  const store = useDashboard()
  const curCommunity = useCommunity()
  const { overview } = store

  const { data } = useQuery(S.communityOverview, {
    slug: curCommunity.slug,
    incViews: false,
  })

  const updateOverview = (community: TCommunity): void => {
    const { meta, views, subscribersCount } = community

    store.commit({
      // @ts-expect-error
      overview: {
        views,
        subscribersCount,
        ...meta,
      },
    })
  }

  useEffect(() => {
    if (data?.community) updateOverview(data.community)
  }, [data, updateOverview]),
    updateOverview
  return overview
}
