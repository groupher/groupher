import Link from 'next/link'
import type { FC } from 'react'
import useCommunity from '~/hooks/useCommunity'
import useHeaderLinks from '~/hooks/useHeaderLinks'
import usePublicThreads from '~/hooks/usePublicThreads'
import useViewingThread from '~/hooks/useViewingThread'
import type { TSpace } from '~/spec'

import CustomHeaderLinks from '~/widgets/CustomHeaderLinks'

import useSalon, { cn } from '../salon/header_layout/thread_tab'

type TProps = TSpace

const ThreadTab: FC<TProps> = ({ ...spacing }) => {
  const s = useSalon({ ...spacing })

  const { slug: community } = useCommunity()
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
            href={`/${community}/${item.slug}`}
            prefetch={true}
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
