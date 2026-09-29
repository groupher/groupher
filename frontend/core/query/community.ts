import { type QueryClient, queryOptions } from '@tanstack/react-query'

import type { TCommunity } from '~/spec'

import { fetchCommunitySnapshot } from './communitySource'

export const communityKeys = {
  all: ['community-config'] as const,
  config: (community: string) => [...communityKeys.all, community] as const,
  pressConfig: (community: string) => [...communityKeys.all, 'press-config', community] as const,
}

/** Removes dashboard and viewer fields before Community becomes canonical Query data. */
export const projectCommunityConfig = (source: TCommunity): TCommunity => {
  const { dashboard: _dashboard, viewerHasSubscribed: _viewerHasSubscribed, ...community } = source
  return community
}

type TCommunityConfigSeed = () => TCommunity | Promise<TCommunity>

const config = (community: string, seed?: TCommunityConfigSeed) =>
  queryOptions({
    queryKey: communityKeys.config(community),
    queryFn: async (): Promise<TCommunity> => {
      if (seed) return projectCommunityConfig(await seed())

      return projectCommunityConfig(await fetchCommunitySnapshot(community))
    },
    enabled: !!community,
    staleTime: 60_000,
  })

/** Applies a typed mutation result to the canonical Community Query owner. */
export const patchCommunityConfig = (
  queryClient: QueryClient,
  community: string,
  patch: Partial<TCommunity>,
): void => {
  queryClient.setQueryData<TCommunity>(communityKeys.config(community), (previous) =>
    previous ? projectCommunityConfig({ ...previous, ...patch }) : previous,
  )
}

export const communityQueries = { config }
