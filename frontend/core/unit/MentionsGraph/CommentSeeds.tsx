import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import useTrans from '~/hooks/useTrans'
import { mentionsGraphQueries, type MentionsGraphFocus } from '~/query/mentionsGraph'

type Props = {
  community: string
  focus: MentionsGraphFocus
  revision: string | null
  onSelect: (focus: MentionsGraphFocus) => void
}

export default function CommentSeeds({ community, focus, revision, onSelect }: Props) {
  const { t } = useTrans()
  const client = useQueryClient()
  const key = useMemo(
    () => mentionsGraphQueries.articleCommentsKey(community, focus),
    [community, focus],
  )
  const query = useInfiniteQuery({
    ...mentionsGraphQueries.articleComments(community, focus),
    enabled: !!revision,
  })
  const matchesRevision =
    !!revision && query.data?.pages.every((page) => page.revision === revision) === true
  const comments = matchesRevision ? (query.data?.pages.flatMap((page) => page.comments) ?? []) : []

  useEffect(() => {
    if (!revision || !query.data || matchesRevision) return
    void client.resetQueries({ queryKey: key, exact: true })
  }, [client, key, matchesRevision, query.data, revision])

  if (query.isError) {
    return (
      <div className='py-3'>
        <p role='status' className='text-digest text-sm'>
          {t('mentions_graph.comments.failed')}
        </p>
        <button
          type='button'
          className='text-accent mt-2 text-sm hover:underline'
          onClick={() => void query.refetch()}
        >
          {t('mentions_graph.retry')}
        </button>
      </div>
    )
  }

  if (query.isPending || !matchesRevision) {
    return (
      <p role='status' className='text-digest py-3 text-sm'>
        {t('mentions_graph.comments.loading')}
      </p>
    )
  }

  return (
    <div className='mt-3'>
      {comments.length === 0 ? (
        <p className='text-digest py-2 text-sm'>{t('mentions_graph.comments.empty')}</p>
      ) : (
        <ul className='space-y-2'>
          {comments.map((comment) => (
            <li key={`${comment.articleInnerId}:${comment.commentInnerId}`}>
              <button
                type='button'
                className='text-accent text-left text-sm hover:underline'
                onClick={() => onSelect(comment)}
              >
                {t('mentions_graph.comments.item', { id: comment.commentInnerId ?? '' })}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <button
          type='button'
          className='text-accent mt-3 text-sm hover:underline'
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage
            ? t('mentions_graph.comments.loading')
            : t('mentions_graph.comments.more')}
        </button>
      )}
    </div>
  )
}
