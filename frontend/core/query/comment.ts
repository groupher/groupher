import { queryOptions } from '@tanstack/react-query'

import { browserQuery } from '~/graphql/client'
import { stripPagedCommentViewerState } from '~/lib/commentViewerState'
import type { TPagedComments, TThread } from '~/spec'
import commentsSchema from '~/unit/Comments/schema'

import { commentKeys } from './key'

const list = (
  community: string,
  thread: TThread,
  innerId: string | number,
  page = 1,
  mode = 'REPLIES',
) =>
  queryOptions({
    queryKey: commentKeys.list(community, thread, innerId, page, mode),
    queryFn: async () => {
      const data = await browserQuery(commentsSchema.pagedComments, {
        article: { community, thread, innerId: String(innerId) },
        mode: mode as 'REPLIES' | 'TIMELINE',
        filter: { page, size: 30 },
      })
      return stripPagedCommentViewerState(data.pagedComments as unknown as TPagedComments)
    },
  })

export const commentQueries = { list }
