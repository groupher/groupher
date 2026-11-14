import type { VariablesOf } from '@graphql-typed-document-node/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import { pressMutationKeys, pressQueries } from '~/query'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import { updatePressConfig } from '~/schemas/pages/press'
import useCommunity from '~/stores/community/hooks'

type TUpdatePressConfigInput = NonNullable<VariablesOf<typeof updatePressConfig>['input']>
type TFeedThread = NonNullable<TUpdatePressConfigInput['feedThreads']>[number]
type TFeedType = 'full' | 'digest'

type TPressDraft = {
  feedEnabled: boolean
  markdownEnabled: boolean
  llmsEnabled: boolean
  sitemapEnabled: boolean
  feedThreads: string[]
  feedType: TFeedType
  feedCount: number
}

type TOutputField = 'feedEnabled' | 'markdownEnabled' | 'llmsEnabled' | 'sitemapEnabled'

type TRet = TPressDraft & {
  saving: boolean
  isTouched: boolean
  canSave: boolean
  setFeedType: (type: TFeedType) => void
  setFeedCount: (count: number) => void
  toggleOutput: (field: TOutputField, value: boolean) => void
  toggleThread: (thread: string, value: boolean) => void
  rssOnSave: () => void
  rssOnCancel: () => void
}

const DEFAULT_DRAFT: TPressDraft = {
  feedEnabled: false,
  markdownEnabled: true,
  llmsEnabled: true,
  sitemapEnabled: true,
  feedThreads: [],
  feedType: 'digest',
  feedCount: 20,
}

/** Exposes the community Press configuration draft and save actions. */
export default function useRSS(): TRet {
  const { slug: community } = useCommunity()
  const queryClient = useQueryClient()
  const { data } = useQuery(pressQueries.slug(community))
  const [draft, setDraft] = useState<TPressDraft>(DEFAULT_DRAFT)
  const original = useRef<TPressDraft>(DEFAULT_DRAFT)

  const updateMutation = useMutation({
    mutationKey: pressMutationKeys.update(community),
    mutationFn: (submitted: TPressDraft) =>
      executeCommand({
        request: (variables) => browserGraphQLRequest(updatePressConfig, variables),
        variables: {
          input: {
            community,
            feedEnabled: submitted.feedEnabled,
            feedType: submitted.feedType.toUpperCase() as TUpdatePressConfigInput['feedType'],
            feedCount: submitted.feedCount,
            feedThreads: submitted.feedThreads.map((thread) => thread.toUpperCase() as TFeedThread),
            llmsEnabled: submitted.llmsEnabled,
            markdownEnabled: submitted.markdownEnabled,
            sitemapEnabled: submitted.sitemapEnabled,
          },
        },
      }),
    onSuccess: (_data, submitted) => {
      original.current = submitted
      void invalidate(queryClient, QueryInvalidation.press.slug(community))
    },
  })

  useEffect(() => {
    if (!data) return

    const next: TPressDraft = {
      feedEnabled: data.feedEnabled,
      markdownEnabled: data.markdownEnabled,
      llmsEnabled: data.llmsEnabled,
      sitemapEnabled: data.sitemapEnabled,
      feedThreads: data.feedThreads.map((thread) => thread.toLowerCase()),
      feedType: data.feedType.toLowerCase() as TFeedType,
      feedCount: data.feedCount,
    }
    setDraft(next)
    original.current = next
  }, [data])

  return {
    ...draft,
    saving: updateMutation.isPending,
    isTouched: JSON.stringify(draft) !== JSON.stringify(original.current),
    canSave: !draft.feedEnabled || draft.feedThreads.length > 0,
    setFeedType: (feedType) => setDraft((current) => ({ ...current, feedType })),
    setFeedCount: (feedCount) => setDraft((current) => ({ ...current, feedCount })),
    toggleOutput: (field, value) => setDraft((current) => ({ ...current, [field]: value })),
    toggleThread: (thread, value) =>
      setDraft((current) => ({
        ...current,
        feedThreads: value
          ? Array.from(new Set([...current.feedThreads, thread]))
          : current.feedThreads.filter((item) => item !== thread),
      })),
    rssOnSave: () => updateMutation.mutate(draft),
    rssOnCancel: () => setDraft(original.current),
  }
}
