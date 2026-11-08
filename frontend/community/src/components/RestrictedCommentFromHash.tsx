import { loadMentionedComment } from '@community/server/mentionedComment'
import { useEffect, useState } from 'react'

import RestrictedMentionComment from './RestrictedMentionComment'

type Comment = NonNullable<Awaited<ReturnType<typeof loadMentionedComment>>>

/** Resolves the URL fragment on the client; fragments are not sent in HTTP requests. */
export default function RestrictedCommentFromHash({
  community,
  articleId,
}: {
  community: string
  articleId: string
}) {
  const [comment, setComment] = useState<Comment | null>(null)

  useEffect(() => {
    let active = true
    let request = 0

    const load = () => {
      const currentRequest = ++request
      const commentInnerId = /^#comment-([1-9][0-9]*)$/.exec(window.location.hash)?.[1]
      setComment(null)
      if (!commentInnerId) return

      void loadMentionedComment({ data: { community, articleId, commentInnerId } })
        .then((result) => {
          if (active && request === currentRequest) setComment(result)
        })
        .catch(() => {
          if (active && request === currentRequest) setComment(null)
        })
    }

    load()
    window.addEventListener('hashchange', load)
    return () => {
      active = false
      window.removeEventListener('hashchange', load)
    }
  }, [community, articleId])

  return comment ? <RestrictedMentionComment comment={comment} /> : null
}
