import type { VariablesOf } from '@graphql-typed-document-node/core'
import { queryOptions } from '@tanstack/react-query'

import { browserQuery } from '~/graphql/client'
import {
  communityActivity,
  communityActivityConfig,
  communityActivityEvent,
  communityActivityExport,
  communityActivityStats,
} from '~/schemas/pages/activity'

type TActivityFilter = NonNullable<VariablesOf<typeof communityActivity>['filter']>
type TActivityStatsFilter = VariablesOf<typeof communityActivityStats>['filter']

export const activityKeys = {
  all: ['community-activity'] as const,
  list: (community: string, filter: TActivityFilter) =>
    [...activityKeys.all, 'list', community, filter] as const,
  stats: (community: string, filter: TActivityStatsFilter) =>
    [...activityKeys.all, 'stats', community, filter] as const,
}

const list = (community: string, filter: TActivityFilter) =>
  queryOptions({
    queryKey: activityKeys.list(community, filter),
    queryFn: async () => {
      const data = await browserQuery(communityActivity, { community, filter })
      return data.communityActivity
    },
    enabled: !!community,
    refetchInterval: 30_000,
  })

const stats = (community: string, filter: TActivityStatsFilter) =>
  queryOptions({
    queryKey: activityKeys.stats(community, filter),
    queryFn: async () => {
      const data = await browserQuery(communityActivityStats, { community, filter })
      return data.communityActivityStats
    },
    enabled: !!community,
  })

const config = (community: string) =>
  queryOptions({
    queryKey: [...activityKeys.all, 'config', community] as const,
    queryFn: async () => {
      const data = await browserQuery(communityActivityConfig, { community })
      return data.communityActivityConfig
    },
    enabled: !!community,
    staleTime: 300_000,
  })

const exportActivity = (community: string, filter: TActivityFilter, format: 'CSV' | 'JSON') =>
  browserQuery(communityActivityExport, {
    community,
    filter,
    format,
  })

const event = (community: string, eventRef: string) =>
  queryOptions({
    queryKey: [...activityKeys.all, 'event', community, eventRef] as const,
    queryFn: async () => {
      const data = await browserQuery(communityActivityEvent, { community, eventRef })
      return data.communityActivityEvent
    },
    enabled: !!community && !!eventRef,
  })

export const activityQueries = { list, stats, config, export: exportActivity, event }
