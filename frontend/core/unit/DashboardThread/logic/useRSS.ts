import type { VariablesOf } from '@graphql-typed-document-node/core'
import { useQuery } from '@tanstack/react-query'
import { pick } from 'ramda'
import { useEffect, useRef, useState } from 'react'

import { browserQuery } from '~/graphql/client'
import { graphqlQueryOptions } from '~/query'
import type { TEditFunc, TRSSType } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import S from '../schema/integrations'
import useHelper from './useHelper'

type TUpdatePressConfigInput = NonNullable<VariablesOf<typeof S.updatePressConfig>['input']>

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
  const dsb$ = useDashboard()
  const { slug: community } = useCommunity()
  const { edit, isChanged } = useHelper()
  const { data } = useQuery(graphqlQueryOptions(S.pressConfig, { community }))
  const [options, setOptions] = useState<TOptions>(DEFAULT_OPTIONS)
  const original = useRef<TOptions>(DEFAULT_OPTIONS)

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
    dsb$.commit({
      rssFeedType: config.feedType.toLowerCase() as TRSSType,
      rssFeedCount: config.feedCount,
      original: {
        ...dsb$.original,
        rssFeedType: config.feedType.toLowerCase() as TRSSType,
        rssFeedCount: config.feedCount,
      },
    })
  }, [data?.pressConfig])

  const isTouched =
    isChanged(FIELD.RSS_FEED_TYPE) ||
    isChanged(FIELD.RSS_FEED_COUNT) ||
    JSON.stringify(options) !== JSON.stringify(original.current)

  const rssOnSave = (): void => {
    dsb$.commit({ saving: true })
    void browserQuery(S.updatePressConfig, {
      input: {
        community,
        feedType: dsb$.rssFeedType.toUpperCase() as TUpdatePressConfigInput['feedType'],
        feedCount: dsb$.rssFeedCount,
        ...options,
        feedThreads: options.feedThreads.map(
          (thread) => thread.toUpperCase() as TUpdatePressConfigInput['feedThreads'][number],
        ),
      },
    })
      .then(() => {
        original.current = options
        dsb$.markFieldsToOriginal([FIELD.RSS_FEED_TYPE, FIELD.RSS_FEED_COUNT])
      })
      .catch((error) => console.error('Failed to update Press config', error))
      .finally(() => dsb$.commit({ saving: false }))
  }

  const rssOnCancel = (): void => {
    setOptions(original.current)
    dsb$.rollbackFields([FIELD.RSS_FEED_TYPE, FIELD.RSS_FEED_COUNT])
  }

  return {
    edit,
    ...pick(['rssFeedType', 'rssFeedCount', 'saving'], dsb$),
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
