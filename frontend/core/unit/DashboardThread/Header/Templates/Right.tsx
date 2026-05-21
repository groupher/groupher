import { reject } from 'ramda'
import type { FC } from 'react'

import { HEADER_LAYOUT } from '~/const/layout'
import { THREAD_PATH } from '~/const/thread'
import {
  normalizeHeaderLinks,
  resolveHeaderLinks,
  shouldFoldAboutToMore,
} from '~/hooks/useHeaderLinks/helper'
import AccountSVG from '~/icons/Account'
import type { TActive, TCommunityThread, TLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommunityBrand from '~/unit/CommunityBrand'
import CustomHeaderLinks from '~/unit/HeaderLinks/HeaderTemplate'

import useHeader from '../../logic/useHeader'
import useSalon, { cn } from '../salon/templates/right'

type TProps = {
  threads: readonly TCommunityThread[]
  links: readonly TLinkItem[]
} & TActive

const RADIO_NAME = 'header-layout'

const Right: FC<TProps> = ({ active, threads, links }) => {
  const s = useSalon()
  const { edit } = useHeader()
  const { slug } = useCommunity()

  const radioId = 'header-layout-right'

  const isAboutFold = shouldFoldAboutToMore(normalizeHeaderLinks(links, slug))
  const visibleThreads = isAboutFold
    ? reject((t: TCommunityThread) => t.slug === THREAD_PATH.ABOUT, threads)
    : threads
  const resolvedLinks = resolveHeaderLinks(links, slug, true)

  return (
    <label htmlFor={radioId} className={cn(s.wrapper, active && s.active)}>
      <input
        id={radioId}
        type='radio'
        name={RADIO_NAME}
        checked={active}
        onChange={() => edit(HEADER_LAYOUT.RIGHT, 'headerLayout')}
        className='sr-only'
      />

      <div className={s.left}>
        <CommunityBrand />
      </div>

      <div className={s.right}>
        {visibleThreads.map((thread: TCommunityThread) => (
          <div key={thread.slug} className={s.linkItem}>
            {thread.title}
          </div>
        ))}

        <CustomHeaderLinks links={resolvedLinks} />

        <AccountSVG className={s.accountIcon} />
      </div>
    </label>
  )
}

export default Right
