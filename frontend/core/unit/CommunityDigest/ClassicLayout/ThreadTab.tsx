import Link from 'next/link'
import type { FC } from 'react'

import useHeaderLinks from '~/hooks/useHeaderLinks'
import usePublicThreads from '~/hooks/usePublicThreads'
import useViewingThread from '~/hooks/useViewingThread'
import type { TSpace } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CustomHeaderLinks from '~/unit/HeaderLinks'
import { path2Thread } from '~/utils/thread'

import useSalon from '../salon/classic_layout/thread_tab'

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
        const active = activeThread === path2Thread(item.slug)

        return (
          <Link
            key={item.slug}
            className={active ? s.titleActive : s.title}
            href={`/${community}/${item.slug}`}
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
