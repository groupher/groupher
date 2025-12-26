import { reject } from 'ramda'
import type { FC } from 'react'
import { HEADER_LAYOUT } from '~/const/layout'
import { THREAD } from '~/const/thread'
import AccountSVG from '~/icons/Acount'
import type { TActive, TCommunityThread, TLinkItem } from '~/spec'
import CommunityBrand from '~/widgets/CommunityBrand'
import CustomHeaderLinks from '~/widgets/CustomHeaderLinks/HeaderTemplate'

import useHeader from '../../logic/useHeader'

import useSalon, { cn } from '../../salon/header/templates/right'

type TProps = {
  threads: readonly TCommunityThread[]
  links: readonly TLinkItem[]
} & TActive

const Right: FC<TProps> = ({ active, threads, links }) => {
  const s = useSalon()

  const { edit } = useHeader()
  const isAboutFold = links.length >= 2 && links[0].title !== ''
  const _threads = isAboutFold
    ? reject((t: TCommunityThread) => t.slug === THREAD.ABOUT, threads)
    : threads

  return (
    <button
      className={cn(s.wrapper, active && s.active)}
      onClick={() => edit(HEADER_LAYOUT.RIGHT, 'headerLayout')}
    >
      <div className={s.left}>
        <CommunityBrand />
      </div>

      <div className={s.right}>
        {_threads.map((thread: TCommunityThread) => (
          <div key={thread.slug} className={s.linkItem}>
            {thread.title}
          </div>
        ))}

        <CustomHeaderLinks links={links} />

        <AccountSVG className={s.accountIcon} />
      </div>
    </button>
  )
}

export default Right
