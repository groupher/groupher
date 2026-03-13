import { getPagedComments, getPost } from '~/providers/ssr'

import PreviewCacheSync from '../../../_preview/PreviewCacheSync'
import buildPreviewCacheEntry from '../../buildPreviewCacheEntry'
import PreviewRuntime from '../../PreviewRuntime'

type TProps = {
  community: string
  innerId: number
}

export default async function ArticleContent({ community, innerId }: TProps) {
  const id = String(innerId)

  const [post, pagedComments] = await Promise.all([
    getPost(community, id),
    getPagedComments(community, id),
  ])

  const entry = buildPreviewCacheEntry({ communitySlug: community, innerId, post, pagedComments })

  return (
    <>
      <PreviewCacheSync entry={entry} />
      <PreviewRuntime entry={entry} />
    </>
  )
}
