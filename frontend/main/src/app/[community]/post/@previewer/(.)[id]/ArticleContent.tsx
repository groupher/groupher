import { THREAD } from '~/const/thread'
import ArticleViewer from '~/containers/viewer/ArticleViewer'
import { getPagedComments, getPost } from '~/providers/ssr'
import ArticleStoreProvider from '~/stores/article/provider'
import CommentsStoreProvider from '~/stores/comments/provider'

type TProps = {
  community: string
  id: string
  innerId: number
}

export default async function ArticleContent({ community, id, innerId }: TProps) {
  const [post, pagedComments] = await Promise.all([
    getPost(community, id),
    getPagedComments(community, id),
  ])

  console.log('## pagedComments: ', pagedComments.totalCount)

  const initData = { post, thread: THREAD.POST }
  const commentsInitData = pagedComments
    ? { pagedComments, totalCount: pagedComments.totalCount || 0, initialized: true }
    : { initialized: false }

  return (
    <ArticleStoreProvider initData={initData}>
      <CommentsStoreProvider initData={commentsInitData}>
        <ArticleViewer community={community} innerId={innerId} thread='post' />
      </CommentsStoreProvider>
    </ArticleStoreProvider>
  )
}
