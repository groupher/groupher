import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import type { TComment } from '~/spec'

import { useCommentFeed } from '../pagination/context'
import S from '../schema'

const targetFromHash = (): string | null => {
  if (typeof window === 'undefined') return null
  const match = /^#comment-([1-9][0-9]*)$/.exec(window.location.hash)
  return match?.[1] ?? null
}

const containsComment = (entries: readonly TComment[], target: string): boolean =>
  entries.some(
    (comment) =>
      String(comment.innerId) === target || containsComment(comment.replies ?? [], target),
  )

/** Fetches a linked Comment even when pagination has not loaded its page. */
export default function useCommentDeepLink(entries: readonly TComment[]): TComment | null {
  const { collection } = useCommentFeed()
  const [target, setTarget] = useState(targetFromHash)
  const article = collection.article
  const inPage = target ? containsComment(entries, target) : false

  useEffect(() => {
    const update = () => setTarget(targetFromHash())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  const targetQuery = useQuery({
    queryKey: ['comment-deep-link', article.community, article.thread, article.innerId, target],
    enabled: Boolean(target && article.innerId && !inPage),
    queryFn: async () => {
      const result = await browserGraphQLRequest(S.oneComment, {
        comment: { article, innerId: target! },
      })
      return (result.oneComment ?? null) as TComment | null
    },
  })

  const loaded = targetQuery.data
  const overlay = loaded && target && !inPage ? loaded : null

  useEffect(() => {
    if (!target || (!inPage && !overlay)) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(`comment-${target}`)?.scrollIntoView({ block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [target, inPage, overlay])

  return overlay
}
