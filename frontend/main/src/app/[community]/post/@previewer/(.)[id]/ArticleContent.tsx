import { THREAD } from '~/const/thread'
import { getPagedComments, getPost } from '~/providers/ssr'

import { PreviewCacheSync } from '../../../_preview'
import buildPreviewCacheEntry from '../../buildPreviewCacheEntry'
import PreviewRuntime from '../../PreviewRuntime'

type TProps = {
  community: string
  innerId: string
}

export default async function ArticleContent({ community, innerId }: TProps) {
  const [post, pagedComments] = await Promise.all([
    getPost(community, innerId),
    getPagedComments(community, innerId),
  ])

  const entry = buildPreviewCacheEntry({
    communitySlug: community,
    thread: THREAD.POST,
    innerId,
    post,
    pagedComments,
  })

  return (
    <>
      <PreviewCacheSync entry={entry} />
      <PreviewRuntime entry={entry} />
    </>
  )
}
