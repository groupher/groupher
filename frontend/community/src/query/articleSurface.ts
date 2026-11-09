import type { QueryClient } from '@tanstack/react-query'

import URL_PARAM from '~/const/url_param'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { mergeCursorArticlePages } from '~/lib/pagination/merge'
import { articlePageEntries } from '~/lib/pagination/merge'
import { resolvePagiPosition, toEffectivePagiConfig } from '~/lib/pagination/params'
import { recordPaginationEvent } from '~/lib/pagination/telemetry'
import { hasExplicitPagiPosition, readPagiMobileLayout } from '~/lib/pagination/viewport'
import { communityQueries as coreCommunityQueries, dsbKeys, projectCommunityConfig } from '~/query'
import type { TParseDashboard } from '~/spec'

import { refreshCommunity } from '../server/community'
import { communityQueries } from './queries'

type TSurface = 'posts' | 'changelogs'

/** A revision subtype is mandatory: API mismatches and ambiguous errors must not retry. */
export const isPaginationRevisionMismatch = (error: unknown): boolean => {
  const errors = (error as { errors?: { extensions?: { code?: unknown; mismatch?: unknown } }[] })
    ?.errors
  return (
    Array.isArray(errors) &&
    errors.length > 0 &&
    errors.every((error) => {
      const extensions = (error as { extensions?: { code?: unknown; mismatch?: unknown } } | null)
        ?.extensions
      return Number(extensions?.code) === 4211 && extensions?.mismatch === 'revision'
    })
  )
}

/** Refreshes the canonical bootstrap cache; list recovery never maintains its own config copy. */
export const refreshArticleBootstrap = async (client: QueryClient, community: string) => {
  const shell = await refreshCommunity({ data: { community } })
  if (!shell) throw new Error('Community bootstrap is unavailable')
  client.setQueryData(
    coreCommunityQueries.config(community).queryKey,
    projectCommunityConfig(shell.community),
  )
  client.setQueryData(dsbKeys.config(community), shell.dashboard)
}

/** Drops only this community/surface's page family before restarting at the collection head. */
export const resetArticleSurface = (client: QueryClient, community: string, surface: TSurface) => {
  client.removeQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === 'article' &&
      queryKey[1] === surface &&
      queryKey[2] === 'pagi' &&
      (queryKey[4] as { community?: string } | undefined)?.community === community,
  })
}

const prefetchSurface = async (
  client: QueryClient,
  community: string,
  surface: TSurface,
  search: string,
) => {
  const mobile = readPagiMobileLayout()
  const bootstrapConfig = toEffectivePagiConfig(
    client.getQueryData<TParseDashboard>(dsbKeys.config(community)),
    mobile === true,
  )
  const { config } = resolvePagiPosition(bootstrapConfig, new URLSearchParams(search))
  if (
    mobile === null &&
    !(config.api === 'offset' && hasExplicitPagiPosition(new URLSearchParams(search)))
  )
    return
  const filter = getPagedArticlesParams(community, new URLSearchParams(search), config.defaultSize)
  let chunks: readonly (readonly { innerId?: string | number | null }[])[]
  if (config.api === 'cursor') {
    const result =
      surface === 'posts'
        ? await client.ensureInfiniteQueryData({
            ...communityQueries.postsInfinite(community, config, filter),
            retry: false,
          })
        : await client.ensureInfiniteQueryData({
            ...communityQueries.changelogsInfinite(community, config, filter),
            retry: false,
          })
    const merged = mergeCursorArticlePages(result.pages.map((page) => articlePageEntries(page)))
    if (merged.duplicateCount > 0) {
      recordPaginationEvent({
        surface,
        event: 'duplicate_entries',
        count: merged.duplicateCount,
      })
    }
    chunks = merged.chunks
  } else {
    const result =
      surface === 'posts'
        ? await client.ensureQueryData({
            ...communityQueries.posts(community, config, filter),
            retry: false,
          })
        : await client.ensureQueryData({
            ...communityQueries.changelogs(community, config, filter),
            retry: false,
          })
    if (!result) throw new Error('Community article page is unavailable')
    chunks = [articlePageEntries(result)]
  }
  await Promise.all(
    chunks.map((entries) =>
      client.ensureQueryData(
        communityQueries.stats(
          client,
          community,
          surface === 'posts' ? 'POST' : 'CHANGELOG',
          entries.flatMap((article) => (article.innerId == null ? [] : [article.innerId])),
        ),
      ),
    ),
  )
  if (surface === 'posts') {
    const postInnerIds = [
      ...new Set(
        chunks.flatMap((entries) =>
          entries.flatMap((article) => {
            const innerId = Number(article.innerId)
            return Number.isSafeInteger(innerId) && innerId > 0 ? [innerId] : []
          }),
        ),
      ),
    ].sort((a, b) => a - b)
    const progressBatches: number[][] = []
    for (let index = 0; index < postInnerIds.length; index += 100) {
      progressBatches.push(postInnerIds.slice(index, index + 100))
    }
    await Promise.all(
      progressBatches.map((postInnerIds) =>
        client.ensureQueryData(communityQueries.postTicketProgress(community, postInnerIds)),
      ),
    )
  }
}

/** Prefetches a finite/infinite surface, with one revision-only restart and a recoverable shell. */
export const loadArticleSurface = async (
  client: QueryClient,
  community: string,
  surface: TSurface,
  search: string,
) => {
  try {
    await prefetchSurface(client, community, surface, search)
    return { recovery: null, resetPage: false }
  } catch (error) {
    if (isPaginationRevisionMismatch(error)) {
      try {
        await refreshArticleBootstrap(client, community)
        resetArticleSurface(client, community, surface)
        const start = new URLSearchParams(search)
        start.delete(URL_PARAM.PAGE)
        await prefetchSurface(client, community, surface, start.toString())
        return { recovery: null, resetPage: true }
      } catch {
        recordPaginationEvent({ surface, event: 'ssr_failure', attempt: 2 })
      }
    } else {
      recordPaginationEvent({ surface, event: 'ssr_failure', attempt: 1 })
    }
    resetArticleSurface(client, community, surface)
    return {
      recovery: isPaginationRevisionMismatch(error) ? ('bootstrap' as const) : ('list' as const),
      resetPage: false,
    }
  }
}
