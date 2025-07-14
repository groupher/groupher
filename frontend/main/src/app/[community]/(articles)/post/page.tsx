'use client'

import useLinkMount from '~/hooks/useLinkMount'
import useIsSidebarLayout from '~/hooks/useIsSidebarLayout'
import useViewing from '~/hooks/useViewing'
import { THREAD } from '~/const/thread'

import usePagedPosts, { type TUpdate } from '~/hooks/usePagedPosts'

import PostThread from '~/containers//thread/PostThread'
import { fetchArticlePageData } from '~/utils/ssr/api'

export default () => {
  const isSidebarLayout = useIsSidebarLayout()
  const { community, setActiveThread } = useViewing()
  const { update } = usePagedPosts()

  const loader = async () => {
    console.warn('## -> load real post data in client!')
    const [pagedPosts, tags] = await fetchArticlePageData(community.slug, THREAD.POST)

    update({ pagedPosts, tags } as TUpdate)
    setActiveThread(THREAD.POST)
  }

  useLinkMount(loader)

  return (
    <>
      {isSidebarLayout && <div className="mt-5" />}
      <PostThread />
    </>
  )
}
