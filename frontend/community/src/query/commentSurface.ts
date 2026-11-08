import type { QueryClient } from '@tanstack/react-query'

import { toEffectivePagiConfig } from '~/lib/pagination/params'
import { hasExplicitPagiPosition, readPagiMobileLayout } from '~/lib/pagination/viewport'
import { dsbKeys } from '~/query'
import { resolveCommentPosition } from '~/query/commentPage'
import type { TArticleThread, TParseDashboard } from '~/spec'

import { isPaginationRevisionMismatch, refreshArticleBootstrap } from './articleSurface'
import { communityQueries } from './queries'

/** Parent bootstrap selects the same query shape and key used by the browser. */
export async function prefetchComments(
  client: QueryClient,
  community: string,
  thread: TArticleThread,
  innerId: string,
  search = '',
) {
  const prefetch = () => {
    const mobile = readPagiMobileLayout()
    const config = toEffectivePagiConfig(
      client.getQueryData<TParseDashboard>(dsbKeys.config(community)),
      mobile === true,
    )
    const position = resolveCommentPosition(config, new URLSearchParams(search))
    if (
      mobile === null &&
      !(
        position.config.api === 'offset' &&
        hasExplicitPagiPosition(new URLSearchParams(search), {
          api: 'commentsApi',
          page: 'commentsPage',
          after: 'commentsAfter',
        })
      )
    )
      return
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
