import Link from 'next/link'

import useViewingCommunity from '~/hooks/useViewingCommunity'
import usePublicThreads from '~/hooks/usePublicThreads'
import useViewingThread from '~/hooks/useViewingThread'
import useHeaderLinks from '~/hooks/useHeaderLinks'

import CustomHeaderLinks from '~/widgets/CustomHeaderLinks'

import ThreadIcon from './ThreadIcon'

import useSalon, { cn } from '../salon/sidebar_layout/main_menu'

export default () => {
  const s = useSalon()

  const community = useViewingCommunity()
  const communityPath = community?.slug

  const publicThreads = usePublicThreads()
  const activeThread = useViewingThread()

  const { getCustomLinks } = useHeaderLinks()
  const customLinks = getCustomLinks()

  return (
    <div className={s.wrapper}>
      {publicThreads.map((thread) => {
        const active = activeThread === thread.slug

        return (
          <Link className={s.menuItem} key={thread.slug} href={`/${communityPath}/${thread.slug}`}>
            <ThreadIcon thread={thread.slug} active={active} />
            <div className={cn(s.menuTitle, active && s.titleActive)}>{thread.title}</div>
          </Link>
        )
      })}

      <CustomHeaderLinks links={customLinks} activePath={activeThread} />
    </div>
  )
}
