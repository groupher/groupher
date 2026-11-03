import { THREAD } from '~/const/thread'
import ArticleQueryProvider from '~/query/ArticleQueryProvider'
import CommentsStoreProvider from '~/stores/comments/provider'
import ArticleViewer from '~/unit/ArticleView'

export default function BlogDetail() {
  const { community, id } = useParams({ from: '/$community/blog/$id' })
  return (
    <ArticleQueryProvider community={community} innerId={id} thread={THREAD.BLOG}>
      <CommentsStoreProvider>
        <ArticleViewer community={community} innerId={Number(id)} thread={THREAD.BLOG} isFullView />
      </CommentsStoreProvider>
    </ArticleQueryProvider>
  )
}
import { useParams } from '@tanstack/react-router'
