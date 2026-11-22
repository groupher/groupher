import { useContext, type PropsWithChildren } from 'react'
import { useSnapshot } from 'valtio'

import usePagiConfig from '~/hooks/usePagiConfig'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import useViewingArticle from '~/hooks/useViewingArticle'
import { hasExplicitPagiPosition } from '~/lib/pagination/viewport'
import { articlePathKey } from '~/query/articlePath'
import { resolveCommentPosition } from '~/query/commentPage'
import useCommentReceiptReconcile from '~/query/useCommentReceiptReconcile'
import { StoreContext } from '~/stores/comments/context'
import type { TStore } from '~/stores/comments/spec'
import useDsb from '~/stores/dsb/hooks'

import RootCollection from './RootCollection'

export default function RootFeed({ children }: PropsWithChildren) {
  const store = useContext(StoreContext) as TStore
  const comments = useSnapshot(store)
  const dashboard = useDsb()
  const search = useURLSearchParams()
  const { article, articlePath } = useViewingArticle()
  useCommentReceiptReconcile(article)
  const { config, ready } = usePagiConfig(dashboard, articlePathKey(articlePath))
  const position = resolveCommentPosition(config, search)
  const collection = {
    article: articlePath,
    mode: comments.mode,
    initialAfter: position.initialAfter,
  }
  const identity = JSON.stringify([articlePathKey(articlePath), comments.mode, position])
  if (
    !ready &&
    !(
      position.config.api === 'offset' &&
      hasExplicitPagiPosition(search, {
        api: 'commentsApi',
        page: 'commentsPage',
        after: 'commentsAfter',
      })
    )
  )
    return <div role='status' aria-busy='true' />
  return (
    <RootCollection
      key={identity}
      collection={collection}
      config={position.config}
      initialPage={position.page}
    >
      {children}
    </RootCollection>
  )
}
