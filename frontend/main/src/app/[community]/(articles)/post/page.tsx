'use client'

import useIsSidebarLayout from '~/hooks/useIsSidebarLayout'

import PostThread from '~/containers//thread/PostThread'

const CommunityPostPage = () => {
  const isSidebarLayout = useIsSidebarLayout()

  return (
    <>
      {isSidebarLayout && <div className="mt-5" />}
      <PostThread />
    </>
  )
}

export default CommunityPostPage
