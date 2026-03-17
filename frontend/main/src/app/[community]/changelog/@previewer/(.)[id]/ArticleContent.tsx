import { THREAD } from '~/const/thread'
import { getChangelog, getPagedComments } from '~/providers/ssr'

import { PreviewCacheSync } from '../../../_preview'
import buildPreviewCacheEntry from '../../buildPreviewCacheEntry'
import PreviewRuntime from '../../PreviewRuntime'

type TProps = {
  community: string
  innerId: string
}

export default async function ArticleContent({ community, innerId }: TProps) {
  const [changelog, pagedComments] = await Promise.all([
    getChangelog(community, innerId),
    getPagedComments(community, innerId, 1, THREAD.CHANGELOG),
  ])

  const entry = buildPreviewCacheEntry({
    communitySlug: community,
    thread: THREAD.CHANGELOG,
    innerId,
    changelog,
    pagedComments,
  })

  return (
    <>
      <PreviewCacheSync entry={entry} />
      <PreviewRuntime entry={entry} />
    </>
  )
}
