import type { VariablesOf } from '@graphql-typed-document-node/core'
import { queryOptions } from '@tanstack/react-query'

import { browserQuery } from '~/graphql/client'
import {
  communityActivity,
  communityActivityConfig,
  communityActivityEvent,
  communityActivityStats,
  exportCommunityActivity,
} from '~/schemas/pages/activity'

type TActivitySelection = VariablesOf<typeof communityActivity>['selection']

export const activityKeys = {
  all: ['community-activity'] as const,
  list: (community: string, selection: TActivitySelection, page: number) =>
    [...activityKeys.all, 'list', community, selection, page] as const,
  stats: (community: string, selection: TActivitySelection) =>
    [...activityKeys.all, 'stats', community, selection] as const,
}

const list = (community: string, selection: TActivitySelection, page: number) =>
  queryOptions({
    queryKey: activityKeys.list(community, selection, page),
    queryFn: async () => {
      const data = await browserQuery(communityActivity, { community, selection, page })
      return data.communityActivity
    },
    enabled: !!community,
    refetchInterval: 30_000,
  })

const stats = (community: string, selection: TActivitySelection) =>
  queryOptions({
    queryKey: activityKeys.stats(community, selection),
    queryFn: async () => {
      const data = await browserQuery(communityActivityStats, { community, selection })
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

const exportActivity = (community: string, selection: TActivitySelection, format: 'CSV' | 'JSON') =>
  browserQuery(exportCommunityActivity, {
    community,
    selection,
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
