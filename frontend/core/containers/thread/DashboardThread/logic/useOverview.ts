import { useEffect } from 'react'
import useDashboard from '~/hooks/useDashboard'
import useQuery from '~/hooks/useQuery'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import type { TCommunity, TOverview } from '~/spec'

import S from '../schema'

export default (): TOverview => {
  const store = useDashboard()
  const curCommunity = useViewingCommunity()
  const { overview } = store

  const { data } = useQuery(S.communityOverview, {
    slug: curCommunity.slug,
    incViews: false,
  })

  const updateOverview = (community: TCommunity): void => {
    const { meta, views, subscribersCount } = community

    store.commit({
      overview: {
        views,
        subscribersCount,
        ...meta,
      },
    })
  }

  useEffect(() => {
    if (data?.community) updateOverview(data.community)
  }, [data]),
    updateOverview
  return overview
}
