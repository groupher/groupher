import { useEffect } from 'react'

import type { TOverview, TCommunity } from '~/spec'
import useSubStore from '~/hooks/useSubStore'
import useViewingCommunity from '~/hooks/useViewingCommunity'

import useQuery from '~/hooks/useQuery'

import S from '../schema'

export default (): TOverview => {
  const store = useSubStore('dashboard')
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
  }, [data])

  return overview
}
