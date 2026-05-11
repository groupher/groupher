import { reject } from 'ramda'
import type { FC } from 'react'

import { HEADER_LAYOUT } from '~/const/layout'
import { THREAD_PATH } from '~/const/thread'
import { resolveHeaderLinks } from '~/hooks/useHeaderLinks/helper'
import AccountSVG from '~/icons/Account'
import type { TActive, TCommunityThread, THeaderLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommunityBrand from '~/unit/CommunityBrand'
import CustomHeaderLinks from '~/unit/HeaderLinks/HeaderTemplate'

import useHeader from '../../logic/useHeader'
import useSalon, { cn } from '../../salon/header/templates/float'

type TProps = {
  threads: readonly TCommunityThread[]
  links: readonly THeaderLinkItem[]
} & TActive

const RADIO_NAME = 'header-layout'

const Float: FC<TProps> = ({ active, threads, links }) => {
  const s = useSalon()
  const { edit } = useHeader()
  const { slug } = useCommunity()

  const radioId = 'header-layout-float'

  const isAboutFold = links.length > 0
  const visibleThreads = isAboutFold
    ? reject((t: TCommunityThread) => t.slug === THREAD_PATH.ABOUT, threads)
    : threads
  const resolvedLinks = resolveHeaderLinks(links, slug)

  return (
    <label htmlFor={radioId} className={cn(s.wrapper, active && s.active)}>
      <input
        id={radioId}
        type='radio'
        name={RADIO_NAME}
        checked={active}
        onChange={() => edit(HEADER_LAYOUT.FLOAT, 'headerLayout')}
        className='sr-only'
      />

      <div className={s.left}>
        <CommunityBrand className='-ml-1 scale-90' />
      </div>

      <div className={s.center}>
        {visibleThreads.map((thread: TCommunityThread) => (
          <div className={s.linkItem} key={thread.slug}>
            {thread.title}
          </div>
        ))}

        <CustomHeaderLinks links={resolvedLinks} />
      </div>

      <AccountSVG className={s.accountIcon} />
    </label>
  )
}

export default Float
