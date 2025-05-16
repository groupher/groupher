'use client'

import useLinkMount from '~/hooks/useLinkMount'
import useIsSidebarLayout from '~/hooks/useIsSidebarLayout'
import useViewing from '~/hooks/useViewing'
import { THREAD } from '~/const/thread'

import PostThread from '~/containers//thread/PostThread'

export default () => {
  const isSidebarLayout = useIsSidebarLayout()
  const { setActiveThread } = useViewing()

  const loader = () => {
    console.warn('## -> load real post data in client!')
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
