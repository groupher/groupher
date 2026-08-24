'use client'

/*
 *
 * PostThread
 *
 */

import { COMMUNITY_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'

import ArticlesFilter from './ArticlesFilter'
// import LavaLampLoading from '~/ui/Loading/LavaLampLoading'
import PagedPosts from './PagedPosts'
import useSalon from './salon'
import TagNote from './TagNote'
import ThreadSidebar from './ThreadSidebar'

export default function PostThread() {
  const { communityLayout } = useLayout()
  const s = useSalon()
  return (
    <div className={s.wrapper}>
      <div className={s.layout}>
        <TagNote top={2.5} />
        <ArticlesFilter left={-1.5} top={1.5} bottom={1.5} />
        <PagedPosts />
      </div>

      {communityLayout !== COMMUNITY_LAYOUT.SIDEBAR && <ThreadSidebar />}
    </div>
  )
}
