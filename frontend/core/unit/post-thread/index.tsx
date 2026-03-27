'use client'

/*
 *
 * PostThread
 *
 */

import { BANNER_LAYOUT } from '~/const/layout'

import useFetchPagedPosts from '~/hooks/usePagedPosts/useFetchPagedPosts'
import useLayout from '~/hooks/useLayout'
import ArticlesFilter from './ArticlesFilter'
// import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import PagedPosts from './PagedPosts'
import useSalon from './salon'
import TagNote from './TagNote'
import ThreadSidebar from './ThreadSidebar'

export default function PostThread() {
  const { bannerLayout } = useLayout()
  const s = useSalon()
  useFetchPagedPosts()

  return (
    <div className={s.wrapper}>
      <div className={s.layout}>
        <TagNote />
        <div className={s.filter}>
          <ArticlesFilter />
        </div>
        <PagedPosts />
      </div>

      {bannerLayout !== BANNER_LAYOUT.SIDEBAR && <ThreadSidebar />}
    </div>
  )
}
