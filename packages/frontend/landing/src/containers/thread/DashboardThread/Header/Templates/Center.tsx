import type { FC } from 'react'
import { reject } from 'ramda'

import type { TActive, TCommunityThread, TLinkItem } from '~/spec'

import { THREAD } from '~/const/thread'
import { HEADER_LAYOUT } from '~/const/layout'

import AccountSVG from '~/icons/Acount'

import CustomHeaderLinks from '~/widgets/CustomHeaderLinks/HeaderTemplate'
import CommunityBrand from '~/widgets/CommunityBrand'

import useHeader from '../../logic/useHeader'
import useSalon, { cn } from '../../salon/header/templates/center'

type TProps = {
  threads: TCommunityThread[]
  links: TLinkItem[]
} & TActive

const Center: FC<TProps> = ({ active, threads, links }) => {
  const s = useSalon()

  const { edit } = useHeader()

  const isAboutFold = links.length >= 2 && links[0].title !== ''
  const _threads = isAboutFold
    ? reject((t: TCommunityThread) => t.slug === THREAD.ABOUT, threads)
    : threads

  return (
    <div
      className={cn(s.wrapper, active && s.active)}
      onClick={() => edit(HEADER_LAYOUT.CENTER, 'headerLayout')}
    >
      <CommunityBrand className="-ml-1 scale-90" />
      <div className={s.center}>
        {_threads.map((thread: TCommunityThread) => (
          <div key={thread.slug} className={s.linkItem}>
            {thread.title}
          </div>
        ))}
        <CustomHeaderLinks links={links} />
      </div>
      <AccountSVG className={s.accountIcon} />
    </div>
  )
}

export default Center
