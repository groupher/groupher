import { queryOptions } from '@tanstack/react-query'

import { parseDashboard } from '~/lib/ssr/parse'
import type { TDsb } from '~/spec'

import { fetchCommunity } from './communitySource'

export const dsbKeys = {
  all: ['dsb'] as const,
  slug: (community: string) => [...dsbKeys.all, community] as const,
}

export const dsbMutationKeys = {
  save: (community?: string) =>
    community
      ? ([...dsbKeys.all, 'save', community] as const)
      : ([...dsbKeys.all, 'save'] as const),
  tagCreate: (community: string) => [...dsbKeys.all, 'tag', 'create', community] as const,
  tagUpdate: (community: string) => [...dsbKeys.all, 'tag', 'update', community] as const,
  tagGroupCreate: (community: string) =>
    [...dsbKeys.all, 'tag-group', 'create', community] as const,
  tagGroupUpdate: (community: string) =>
    [...dsbKeys.all, 'tag-group', 'update', community] as const,
  themeSave: (community: string) => [...dsbKeys.all, 'theme', 'save', community] as const,
  contentShadow: (community: string) => [...dsbKeys.all, 'content-shadow', community] as const,
}

type TDsbSeed = () => TDsb | Promise<TDsb>

const slug = (community: string, seed?: TDsbSeed) =>
  queryOptions({
    queryKey: dsbKeys.slug(community),
    queryFn: async (): Promise<TDsb> => {
      if (seed) return seed()

      return parseDashboard(await fetchCommunity(community))
    },
    enabled: !!community,
    meta: { hydration: 'public' },
    staleTime: 60_000,
  })

export const dsbQueries = { slug }
