'use client'

import useViewing from '~/hooks/useViewing'
import usePagedChangelogs, { type TUpdate } from '~/hooks/usePagedChangelogs'

import useLinkMount from '~/hooks/useLinkMount'
import ChangelogThread from '~/containers/thread/ChangelogThread'
import { THREAD } from '~/const/thread'
import { fetchArticlePageData } from '~/utils/api'

const CommunityChangelogPage = () => {
  const { community, setActiveThread } = useViewing()
  const { update, pagedParams } = usePagedChangelogs()

  const loader = async () => {
    console.warn('## -> load real changelog data in client!: ', pagedParams)

    const [pagedChangelogs, tags] = await fetchArticlePageData(community.slug, THREAD.CHANGELOG)
    console.log('## tags on changelog tags: ', tags)
    // articles as TPagedChangelogs
    update({ pagedChangelogs, tags } as TUpdate)
    setActiveThread(THREAD.CHANGELOG)
  }

  useLinkMount(loader)

  return <ChangelogThread />
}

export default CommunityChangelogPage
