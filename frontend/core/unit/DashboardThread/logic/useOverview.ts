import type { ResultOf } from '@graphql-typed-document-node/core'
import { useQuery } from '@tanstack/react-query'

import { graphqlQueryOptions } from '~/query'
import type { TOverview } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema/shell'

type TCommunityOverview = NonNullable<ResultOf<typeof S.communityOverview>['community']>

/** Exposes overview state and actions through the shared React hook boundary. */
export default function useOverview(): TOverview {
  const { slug } = useCommunity()

  const { data } = useQuery(graphqlQueryOptions(S.communityOverview, { slug, incViews: false }))
  const community = data?.community as TCommunityOverview | undefined

  return community
    ? {
        views: community.views,
        subscribersCount: community.subscribersCount,
        ...community.meta,
      }
    : { views: 0, subscribersCount: 0, postsCount: 0, changelogsCount: 0, docsCount: 0 }
}
