import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import { queryOptions } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import { pressConfig } from '~/schemas/pages/press'

export type TPressConfig = ResultOf<typeof pressConfig>['pressConfig']

export const pressKeys = {
  all: ['press'] as const,
  slug: (community: string) => [...pressKeys.all, community] as const,
}

export const pressMutationKeys = {
  update: (community: string) => [...pressKeys.all, community, 'update'] as const,
}

type TPressConfigSeed = () => TPressConfig | Promise<TPressConfig>

const slug = (community: string, seed?: TPressConfigSeed) =>
  queryOptions({
    queryKey: pressKeys.slug(community),
    queryFn: async (): Promise<TPressConfig> => {
      if (seed) return seed()

      const data = await browserGraphQLRequest<
        ResultOf<typeof pressConfig>,
        VariablesOf<typeof pressConfig>
      >(pressConfig, { community })
      return data.pressConfig
    },
    enabled: !!community,
    staleTime: 60_000,
  })

export const pressQueries = { slug }
