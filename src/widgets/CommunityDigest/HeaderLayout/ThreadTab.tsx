import type { FC } from 'react'
import Link from 'next/link'

import type { TSpace } from '~/spec'

import useViewingCommunity from '~/hooks/useViewingCommunity'
import usePublicThreads from '~/hooks/usePublicThreads'
import useHeaderLinks from '~/hooks/useHeaderLinks'
import useViewingThread from '~/hooks/useViewingThread'

import CustomHeaderLinks from '~/widgets/CustomHeaderLinks'

import useSalon, { cn } from '../salon/header_layout/thread_tab'

type TProps = TSpace

const ThreadTab: FC<TProps> = ({ ...spacing }) => {
  const s = useSalon({ ...spacing })

  const community = useViewingCommunity()
  const { getCustomLinks } = useHeaderLinks()
  const threads = usePublicThreads()
  const activeThread = useViewingThread()
  const customLinks = getCustomLinks()

  return (
    <div className={s.wrapper}>
      {threads.map((item) => {
        const active = activeThread === item.slug

        return (
          <Link
            key={item.slug}
            className={cn(s.title, active && s.titleActive)}
            href={`/${community.slug}/${item.slug}`}
            prefetch={false}
          >
            {item.title}
          </Link>
        )
      })}

      <CustomHeaderLinks links={customLinks} activePath={activeThread} />
    </div>
  )
}

export default ThreadTab
