import type { QueryClient } from '@tanstack/react-query'

import URL_PARAM from '~/const/url_param'
import { getPagedArticlesParams } from '~/lib/pagedArticlesFilter'
import { mergeCursorArticlePages } from '~/lib/pagination/merge'
import { articlePageEntries } from '~/lib/pagination/merge'
import { toEffectivePagiConfig } from '~/lib/pagination/params'
import { recordPaginationEvent } from '~/lib/pagination/telemetry'
import {
  articleQueryKeys,
  communityQueries as coreCommunityQueries,
  dsbKeys,
  pickCommunityFields,
} from '~/query'
import type { TDsb } from '~/spec'

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
    coreCommunityQueries.slug(community).queryKey,
    pickCommunityFields(shell.community),
  )
  client.setQueryData(dsbKeys.slug(community), shell.dashboard)
}

/** Drops only this community/surface's page family before restarting at the collection head. */
export const resetArticleSurface = (client: QueryClient, community: string, surface: TSurface) => {
  client.removeQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === articleQueryKeys.all[0] &&
      queryKey[1] === surface &&
      queryKey[2] === 'pagi' &&
      (queryKey[4] as { community?: string } | undefined)?.community === community,
  })
}

/** Rejects malformed envelopes before the SSR list request. */
export const isMalformedCursor = (cursor: string): boolean => {
  try {
    if (!cursor || cursor.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(cursor)) return true
    const envelope = JSON.parse(atob(cursor.replace(/-/g, '+').replace(/_/g, '/')))
    return (
      !envelope ||
      typeof envelope !== 'object' ||
      !envelope.payload ||
      typeof envelope.signature !== 'string'
    )
  } catch {
    return true
  }
}

const prefetchSurface = async (
  client: QueryClient,
  community: string,
  surface: TSurface,
  search: string,
  mobile = false,
) => {
  let config = toEffectivePagiConfig(client.getQueryData<TDsb>(dsbKeys.slug(community)), mobile)
  const position = new URLSearchParams(search)
  const after = position.get('after')
  const invalidCursor = after !== null && isMalformedCursor(after)
  const page = position.get('page')
  const pageNumber = Number(page)
  const invalidPage = page !== null && (!Number.isSafeInteger(pageNumber) || pageNumber < 1)
  const incompatible = invalidCursor || invalidPage || (config.api === 'cursor' && pageNumber > 1)
  if (after && !incompatible && config.api === 'offset') {
    config = { ...config, api: 'cursor', mode: 'LOAD_MORE' }
  }
  if (incompatible) {
    position.delete('page')
    position.delete('after')
  }
  const filter = getPagedArticlesParams(community, position, config.defaultSize)
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
  return incompatible ? position.toString() : undefined
}

/** Prefetches a finite/infinite surface, with one revision-only restart and a recoverable shell. */
export const loadArticleSurface = async (
  client: QueryClient,
  community: string,
  surface: TSurface,
  search: string,
  mobile = false,
) => {
  try {
    const recoveredSearch = await prefetchSurface(client, community, surface, search, mobile)
    return { recovery: null, resetPage: false, recoveredSearch }
  } catch (error) {
    const position = new URLSearchParams(search)
    const codes = (error as { errors?: { extensions?: { code?: number } }[] })?.errors
    if (
      (position.has('after') || position.has('page')) &&
      Array.isArray(codes) &&
      codes.length > 0 &&
      codes.every(({ extensions }) =>
        [4200, 4201, 4202, 4203, 4204, 4205, 4207].includes(Number(extensions?.code)),
      )
    ) {
      position.delete('page')
      position.delete('after')
      const recoveredSearch = position.toString()
      try {
        await prefetchSurface(client, community, surface, recoveredSearch, mobile)
        return { recovery: null, resetPage: false, recoveredSearch }
      } catch {
        resetArticleSurface(client, community, surface)
        return { recovery: 'list' as const, resetPage: false, recoveredSearch }
      }
    }
    if (isPaginationRevisionMismatch(error)) {
      try {
        await refreshArticleBootstrap(client, community)
        resetArticleSurface(client, community, surface)
        const start = new URLSearchParams(search)
        start.delete(URL_PARAM.PAGE)
        await prefetchSurface(client, community, surface, start.toString(), mobile)
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
