import type { QueryClient } from '@tanstack/react-query'

import { toEffectivePagiConfig } from '~/lib/pagination/params'
import { dsbKeys } from '~/query'
import { resolveCommentPosition } from '~/query/commentPage'
import type { TArticleThread, TDsb } from '~/spec'

import { isPaginationRevisionMismatch, refreshArticleBootstrap } from './articleSurface'
import { communityQueries } from './queries'

/** Parent bootstrap selects the same query shape and key used by the browser. */
export async function prefetchComments(
  client: QueryClient,
  community: string,
  thread: TArticleThread,
  innerId: string,
  search = '',
  mobile = false,
) {
  const prefetch = () => {
    const config = toEffectivePagiConfig(client.getQueryData<TDsb>(dsbKeys.slug(community)), mobile)
    const position = resolveCommentPosition(config, new URLSearchParams(search))
    if (position.config.api === 'cursor')
      return client.ensureInfiniteQueryData({
        ...communityQueries.commentsInfinite(
          community,
          thread,
          innerId,
          position.config,
          position.initialAfter,
        ),
        retry: false,
      })
    return client.ensureQueryData({
      ...communityQueries.comments(community, thread, innerId, position.config, position.page),
      retry: false,
    })
  }
  try {
    return await prefetch()
  } catch (error) {
    const errors = (error as { errors?: { extensions?: { code?: unknown } }[] } | null)?.errors
    if (errors?.length && errors.every(({ extensions }) => Number(extensions?.code) === 6008))
      return
    if (!isPaginationRevisionMismatch(error)) throw error
    await refreshArticleBootstrap(client, community)
    return prefetch()
  }
}
