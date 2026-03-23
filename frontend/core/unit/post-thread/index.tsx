'use client'

/*
 *
 * PostThread
 *
 */

import { BANNER_LAYOUT } from '~/const/layout'

import useLayout from '~/hooks/useLayout'
import ArticlesFilter from './ArticlesFilter'
// import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import PagedPosts from './PagedPosts'
import TagNote from './TagNote'
import useSalon from './salon'
import ThreadSidebar from './ThreadSidebar'

export default function PostThread() {
  const { bannerLayout } = useLayout()
  const s = useSalon()

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
