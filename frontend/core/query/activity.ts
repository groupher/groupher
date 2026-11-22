import type { VariablesOf } from '@graphql-typed-document-node/core'
import { queryOptions } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import type { CommunityActivityExportFormat } from '~/lib/graphql/generated/enums'
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
  config: (community: string) => [...activityKeys.all, 'config', community] as const,
  event: (community: string, eventRef: string) =>
    [...activityKeys.all, 'event', community, eventRef] as const,
}

const list = (community: string, selection: TActivitySelection, page: number) =>
  queryOptions({
    queryKey: activityKeys.list(community, selection, page),
    queryFn: async () => {
      const data = await browserGraphQLRequest(communityActivity, {
        community,
        selection,
        pagi: { offset: { page, size: 20 } },
      })
      return data.communityActivity
    },
    enabled: !!community,
    refetchInterval: 30_000,
  })

const stats = (community: string, selection: TActivitySelection) =>
  queryOptions({
    queryKey: activityKeys.stats(community, selection),
    queryFn: async () => {
      const data = await browserGraphQLRequest(communityActivityStats, { community, selection })
      return data.communityActivityStats
    },
    enabled: !!community,
  })

const config = (community: string) =>
  queryOptions({
    queryKey: activityKeys.config(community),
    queryFn: async () => {
      const data = await browserGraphQLRequest(communityActivityConfig, { community })
      return data.communityActivityConfig
    },
    enabled: !!community,
    staleTime: 300_000,
  })

const exportActivity = (
  community: string,
  selection: TActivitySelection,
  format: CommunityActivityExportFormat,
) =>
  browserGraphQLRequest(exportCommunityActivity, {
    community,
    selection,
    format,
  })

export const activityCommands = { export: exportActivity }

const event = (community: string, eventRef: string) =>
  queryOptions({
    queryKey: activityKeys.event(community, eventRef),
    queryFn: async () => {
      const data = await browserGraphQLRequest(communityActivityEvent, { community, eventRef })
      return data.communityActivityEvent
    },
    enabled: !!community && !!eventRef,
  })

export const activityQueries = { list, stats, config, event }
