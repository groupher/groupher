import { queryOptions } from '@tanstack/react-query'

import { parseDashboard } from '~/lib/ssr/parse'
import type { TParseDashboard } from '~/spec'

import { fetchCommunity } from './communitySource'

export const dsbKeys = {
  all: ['dsb'] as const,
  config: (community: string) => [...dsbKeys.all, 'config', community] as const,
}

export const dsbMutationKeys = {
  save: (community?: string) =>
    community
      ? ([...dsbKeys.all, 'save', community] as const)
      : ([...dsbKeys.all, 'save'] as const),
}

type TDsbConfigSeed = () => TParseDashboard | Promise<TParseDashboard>

const config = (community: string, seed?: TDsbConfigSeed) =>
  queryOptions({
    queryKey: dsbKeys.config(community),
    queryFn: async (): Promise<TParseDashboard> => {
      if (seed) return seed()

      return parseDashboard(await fetchCommunity(community))
    },
    enabled: !!community,
    staleTime: 60_000,
  })

export const dsbQueries = { config }
