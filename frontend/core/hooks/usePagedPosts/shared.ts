import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

import TYPE from '~/const/type'
import { useArticleStatesByChunks } from '~/hooks/useArticleStates'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { normalizePaginationError } from '~/lib/pagination/errors'
import { Q } from '~/query'
import type {
  TEffectivePagiConfig,
  TPagedArticleViewModels,
  TPagedArticlesParams,
  TGraphQLPagiPageInfo,
  TPost,
  TPostTicketProgress,
  TResState,
} from '~/spec'
import useCommunity from '~/stores/community/hooks'

import type { TPagedPostsResult } from './context'

/** Reads the stable community/filter input shared by both pagination surfaces. */
export const usePagedPostsInput = (
  config: TEffectivePagiConfig,
): { pagedParams: TPagedArticlesParams } => {
  const { slug } = useCommunity()
  const searchParams = useURLSearchParams()
  return { pagedParams: getPagedArticlesParams(slug, searchParams, config.defaultSize) }
}

type TComposeOptions = {
  pageInfo?: TGraphQLPagiPageInfo
  articleChunks: readonly (readonly TPost[])[]
  pagedParams: TPagedArticlesParams
  resState: TResState
  config: TEffectivePagiConfig
  initialError: unknown
  isRetryingInitial: boolean
  retryInitial: () => Promise<unknown>
  hasNextPage: boolean
  isFetchingNextPage: boolean
  nextPageError: unknown
  retryNextPage: () => Promise<unknown>
  fetchNextPage: () => Promise<unknown>
}

/** Composes list view models while retaining each loaded page's state batch boundary. */
export const usePagedPostsResult = ({
  articleChunks,
  pageInfo,
  pagedParams,
  resState,
  config,
  initialError,
  isRetryingInitial,
  retryInitial,
  hasNextPage,
  isFetchingNextPage,
  nextPageError,
  retryNextPage,
  fetchNextPage,
}: TComposeOptions): TPagedPostsResult => {
  const states = useArticleStatesByChunks<TPost>(articleChunks)
  const postInnerIds = useMemo(
    () =>
      [
        ...new Set(
          states.flatMap(({ content }) => {
            const innerId = Number(content.innerId)
            return Number.isSafeInteger(innerId) && innerId > 0 ? [innerId] : []
          }),
        ),
      ].sort((a, b) => a - b),
    [states],
  )
  const progressBatches = useMemo(() => {
    const batches: number[][] = []
    for (let index = 0; index < postInnerIds.length; index += 100) {
      batches.push(postInnerIds.slice(index, index + 100))
    }
    return batches
  }, [postInnerIds])
  const progressQueries = useQueries({
    queries: progressBatches.map((ids) => Q.ticket.postProgress(pagedParams.community || '', ids)),
  })
  const progressByPostInnerId = useMemo(() => {
    const progress = new Map<number, TPostTicketProgress>()
    for (const query of progressQueries) {
      for (const item of query.data || []) progress.set(item.postInnerId, item)
    }
    return progress
  }, [progressQueries])
  const viewModels = useMemo<TPagedArticleViewModels>(
    () => ({
      pageInfo,
      entries: states.map(({ content, stats, viewerState }) => ({
        content,
        stats,
        viewerState,
        ticketProgress:
          content.innerId == null
            ? null
            : (progressByPostInnerId.get(Number(content.innerId)) ?? null),
      })),
    }),
    [pageInfo, states, progressByPostInnerId],
  )

  return {
    resState,
    pagedPosts: viewModels,
    pagedParams,
    paginationApi: config.api,
    paginationMode: config.mode,
    initialError: normalizePaginationError(initialError),
    isRetryingInitial,
    retryInitial,
    hasNextPage,
    isFetchingNextPage,
    nextPageError: normalizePaginationError(nextPageError),
    retryNextPage,
    fetchNextPage,
  }
}

/** Maps the active query's pending state to the list response state. */
export const loadingOrDone = (isPending: boolean): TResState =>
  (isPending ? TYPE.RES_STATE.LOADING : TYPE.RES_STATE.DONE) as TResState
