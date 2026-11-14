import { type QueryClient, queryOptions } from '@tanstack/react-query'

import type { TCommunity } from '~/spec'

import { fetchCommunity } from './communitySource'

export const communityKeys = {
  all: ['community'] as const,
  slug: (community: string) => [...communityKeys.all, community] as const,
}

/** Removes dashboard and viewer fields before Community becomes canonical Query data. */
export const pickCommunityFields = (source: TCommunity): TCommunity => {
  const { dashboard: _dashboard, viewerHasSubscribed: _viewerHasSubscribed, ...community } = source
  return community
}

type TCommunitySeed = () => TCommunity | Promise<TCommunity>

const slug = (community: string, seed?: TCommunitySeed) =>
  queryOptions({
    queryKey: communityKeys.slug(community),
    queryFn: async (): Promise<TCommunity> => {
      if (seed) return pickCommunityFields(await seed())

      return pickCommunityFields(await fetchCommunity(community))
    },
    enabled: !!community,
    meta: { hydration: 'public' },
    staleTime: 60_000,
  })

/** Applies a typed mutation result to the canonical Community Query owner. */
export const patchCommunity = (
  queryClient: QueryClient,
  community: string,
  patch: Partial<TCommunity>,
): void => {
  queryClient.setQueryData<TCommunity>(communityKeys.slug(community), (previous) =>
    previous ? pickCommunityFields({ ...previous, ...patch }) : previous,
  )
}

export const communityQueries = { slug }
