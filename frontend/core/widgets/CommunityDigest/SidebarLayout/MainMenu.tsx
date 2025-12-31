import Link from 'next/link'

import useCommunity from '~/hooks/useCommunity'
import useHeaderLinks from '~/hooks/useHeaderLinks'
import usePublicThreads from '~/hooks/usePublicThreads'
import useViewingThread from '~/hooks/useViewingThread'

import CustomHeaderLinks from '~/widgets/CustomHeaderLinks'
import useSalon, { cn } from '../salon/sidebar_layout/main_menu'
import ThreadIcon from './ThreadIcon'

export default () => {
  const s = useSalon()

  const { slug: community } = useCommunity()

  const publicThreads = usePublicThreads()
  const activeThread = useViewingThread()

  const { getCustomLinks } = useHeaderLinks()
  const customLinks = getCustomLinks()

  return (
    <div className={s.wrapper}>
      {publicThreads.map((thread) => {
        const active = activeThread === thread.slug

        return (
          <Link className={s.menuItem} key={thread.slug} href={`/${community}/${thread.slug}`}>
            <ThreadIcon thread={thread.slug} active={active} />
            <div className={cn(s.menuTitle, active && s.titleActive)}>{thread.title}</div>
          </Link>
        )
      })}

      <CustomHeaderLinks links={customLinks} activePath={activeThread} />
    </div>
  )
}
