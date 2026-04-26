import Link from 'next/link'

import useHeaderLinks from '~/hooks/useHeaderLinks'
import usePublicThreads from '~/hooks/usePublicThreads'
import useViewingThread from '~/hooks/useViewingThread'
import useCommunity from '~/stores/community/hooks'
import CustomHeaderLinks from '~/unit/HeaderLinks'
import { path2Thread } from '~/utils/thread'

import useSalon, { cn } from '../salon/sidebar_layout/main_menu'
import ThreadIcon from './ThreadIcon'

export default function MainMenu() {
  const s = useSalon()

  const { slug: community } = useCommunity()

  const publicThreads = usePublicThreads()
  const activeThread = useViewingThread()

  const { getCustomLinks } = useHeaderLinks()
  const customLinks = getCustomLinks()

  return (
    <div className={s.wrapper}>
      {publicThreads.map((thread) => {
        const active = activeThread === path2Thread(thread.slug)

        return (
          <Link className={s.menuItem} key={thread.slug} href={`/${community}/${thread.slug}`}>
            <ThreadIcon thread={path2Thread(thread.slug)} active={active} />
            <div className={cn(s.menuTitle, active && s.titleActive)}>{thread.title}</div>
          </Link>
        )
      })}

      <CustomHeaderLinks links={customLinks} activePath={activeThread} />
    </div>
  )
}
