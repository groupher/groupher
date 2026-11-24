import { useContext } from 'react'

import { THREAD } from '~/const/thread'
import { PagedChangelogsContext } from '~/hooks/usePagedChangelogs/context'
import { PagedPostsContext } from '~/hooks/usePagedPosts/context'
import useViewingArticle from '~/hooks/useViewingArticle'
import useViewingThread from '~/hooks/useViewingThread'
import type { TArticle } from '~/spec'

type TRes = {
  previous: TArticle | null
  next: TArticle | null
}

/** Exposes navi article state and actions through the shared React hook boundary. */
export default function useNaviArticle(): TRes {
  const posts = useContext(PagedPostsContext)
  const changelogs = useContext(PagedChangelogsContext)
  const curThread = useViewingThread()
  const { article: viewingArticle } = useViewingArticle()

  const entries =
    curThread === THREAD.POST
      ? posts?.pagedPosts.entries
      : curThread === THREAD.CHANGELOG
        ? changelogs?.pagedChangelogs.entries
        : undefined
  const curIndex = entries?.findIndex(({ content }) => content.id === viewingArticle?.id) ?? -1

  if (!viewingArticle?.id || !entries || curIndex < 0) {
    return {
      previous: null,
      next: null,
    }
  }

  return {
    previous: entries[curIndex - 1]?.content || null,
    next: entries[curIndex + 1]?.content || null,
  }
}
