import { reject } from 'ramda'
import type { FC } from 'react'
import { HEADER_LAYOUT } from '~/const/layout'

import { THREAD } from '~/const/thread'
import AccountSVG from '~/icons/Account'
import type { TActive, TCommunityThread, TLinkItem } from '~/spec'
import CommunityBrand from '~/widgets/CommunityBrand'
import CustomHeaderLinks from '~/widgets/CustomHeaderLinks/HeaderTemplate'

import useHeader from '../../logic/useHeader'
import useSalon, { cn } from '../../salon/header/templates/float'

type TProps = {
  threads: readonly TCommunityThread[]
  links: readonly TLinkItem[]
} & TActive

const Float: FC<TProps> = ({ active, threads, links }) => {
  const s = useSalon()

  const { edit } = useHeader()
  const isAboutFold = links.length >= 2 && links[0].title !== ''
  const _threads = isAboutFold
    ? reject((t: TCommunityThread) => t.slug === THREAD.ABOUT, threads)
    : threads

  return (
    <button
      className={cn(s.wrapper, active && s.active)}
      onClick={() => edit(HEADER_LAYOUT.FLOAT, 'headerLayout')}
    >
      <div className={s.left}>
        <CommunityBrand className='-ml-1 scale-90' />
      </div>
      <div className={s.center}>
        {_threads.map((thread: TCommunityThread) => (
          <div className={s.linkItem} key={thread.slug}>
            {thread.title}
          </div>
        ))}

        <CustomHeaderLinks links={links} />
      </div>
      <AccountSVG className={s.accountIcon} />
    </button>
  )
}

export default Float
