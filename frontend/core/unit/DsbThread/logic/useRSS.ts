import type { VariablesOf } from '@graphql-typed-document-node/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pick } from 'ramda'
import { useEffect, useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import { communityKeys, graphqlQueryOptions } from '~/query'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import type { TEditFunc, TRSSType } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDsbEdit from '~/stores/dsbEdit/hooks'

import { FIELD } from '../constant'
import S from '../schema/integrations'
import useHelper from './useHelper'

type TUpdatePressConfigInput = NonNullable<VariablesOf<typeof S.updatePressConfig>['input']>
type TUpdatePressConfigRequest = TUpdatePressConfigInput & { options: TOptions }

type TOutputField = 'feedEnabled' | 'markdownEnabled' | 'llmsEnabled' | 'sitemapEnabled'
type TOptions = Record<TOutputField, boolean> & { feedThreads: string[] }

type TRet = TOptions & {
  rssFeedType: TRSSType
  rssFeedCount: number
  saving: boolean
  isTouched: boolean
  canSave: boolean
  edit: TEditFunc
  toggleOutput: (field: TOutputField, value: boolean) => void
  toggleThread: (thread: string, value: boolean) => void
  rssOnSave: () => void
  rssOnCancel: () => void
}

const DEFAULT_OPTIONS: TOptions = {
  feedEnabled: false,
  markdownEnabled: true,
  llmsEnabled: true,
  sitemapEnabled: true,
  feedThreads: [],
}

/** Exposes rss state and actions through the shared React hook boundary. */
export default function useRSS(): TRet {
  const dsb$ = useDsbEdit()
  const { slug: community } = useCommunity()
  const { edit, isChanged } = useHelper()
  const pressConfigQuery = graphqlQueryOptions(
    S.pressConfig,
    { community },
    {
      queryKey: communityKeys.pressConfig(community),
    },
  )
  const { data } = useQuery(pressConfigQuery)
  const queryClient = useQueryClient()
  const [options, setOptions] = useState<TOptions>(DEFAULT_OPTIONS)
  const original = useRef<TOptions>(DEFAULT_OPTIONS)

  const updateMutation = useMutation({
    mutationKey: ['dsb', 'press-config', community],
    mutationFn: ({ options: _options, ...input }: TUpdatePressConfigRequest) =>
      browserGraphQLRequest(S.updatePressConfig, { input }),
    onSuccess: (_data, input) => {
      original.current = input.options
      dsb$.accept([FIELD.RSS_FEED_TYPE, FIELD.RSS_FEED_COUNT])
      void invalidate(queryClient, QueryInvalidation.community.pressConfig(community))
    },
  })

  useEffect(() => {
    if (!data?.pressConfig) return
    const config = data.pressConfig
    const next = {
      feedEnabled: config.feedEnabled,
      markdownEnabled: config.markdownEnabled,
      llmsEnabled: config.llmsEnabled,
      sitemapEnabled: config.sitemapEnabled,
      feedThreads: config.feedThreads.map((thread) => thread.toLowerCase()),
    }
    setOptions(next)
    original.current = next
    const confirmed = {
      rssFeedType: config.feedType.toLowerCase() as TRSSType,
      rssFeedCount: config.feedCount,
    }
    dsb$.reconcile({
      fields: [FIELD.RSS_FEED_TYPE, FIELD.RSS_FEED_COUNT],
      submitted: confirmed,
      confirmed,
    })
  }, [data?.pressConfig])

  const isTouched =
    isChanged(FIELD.RSS_FEED_TYPE) ||
    isChanged(FIELD.RSS_FEED_COUNT) ||
    JSON.stringify(options) !== JSON.stringify(original.current)

  const rssOnSave = (): void => {
    updateMutation.mutate({
      community,
      feedType: dsb$.rssFeedType.toUpperCase() as TUpdatePressConfigInput['feedType'],
      feedCount: dsb$.rssFeedCount,
      options,
      ...options,
      feedThreads: options.feedThreads.map(
        (thread) => thread.toUpperCase() as TUpdatePressConfigInput['feedThreads'][number],
      ),
    })
  }

  const rssOnCancel = (): void => {
    setOptions(original.current)
    dsb$.rollback([FIELD.RSS_FEED_TYPE, FIELD.RSS_FEED_COUNT])
  }

  return {
    edit,
    ...pick(['rssFeedType', 'rssFeedCount'], dsb$),
    saving: updateMutation.isPending,
    ...options,
    isTouched,
    canSave: !options.feedEnabled || options.feedThreads.length > 0,
    toggleOutput: (field, value) => setOptions((current) => ({ ...current, [field]: value })),
    toggleThread: (thread, value) =>
      setOptions((current) => ({
        ...current,
        feedThreads: value
          ? Array.from(new Set([...current.feedThreads, thread]))
          : current.feedThreads.filter((item) => item !== thread),
      })),
    rssOnSave,
    rssOnCancel,
  }
}
