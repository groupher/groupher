import Link from 'next/link'
import { useEffect, useState } from 'react'
import useHover from '~/hooks/useHover'
import ArrowSVG from '~/icons/ArrowUpRight'
import DiscussSVG from '~/icons/Discuss'
import GithubSVG from '~/icons/Github8'
import OptionArrowSVG from '~/icons/OptionArrow'
import PlusSVG from '~/icons/PlusCircle'
import GlobalSVG from '~/icons/social/Global'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import CommunityBrand from '~/unit/CommunityBrand'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from '../salon/classic_layout/community_brief'

export default function CommunityBrief() {
  const s = useSalon()

  const [disableTippyJump, setDisableTippyJump] = useState(false)
  const { slug } = useCommunity()
  const dsb$ = useDashboard()

  const [ref, isHovering] = useHover<HTMLDivElement>()

  useEffect(() => {
    if (isHovering && disableTippyJump !== true) {
      setDisableTippyJump(true)
    }
  }, [isHovering, disableTippyJump])

  return (
    <Tooltip
      content={
        <div className={s.panel}>
          <div className={s.brandPanel}>
            <CommunityBrand />
          </div>

          <Link className={cn(s.menuItem, 'hover:no-underline')} href={`/${slug}`}>
            <div className={s.menuIconBox}>
              <DiscussSVG className={s.menuIcon} />
            </div>

            <div className={s.menuTitle}>社区主页</div>
          </Link>

          <Link className={s.menuItem} href={dsb$.homepage}>
            <div className={s.menuIconBox}>
              <GlobalSVG className={s.menuIcon} />
            </div>
            <div className={s.menuTitle}>返回官网</div>
            <ArrowSVG className={s.linkArrow} />
          </Link>

          <Link className={s.menuItem} href={`/${slug}`}>
            <div className={s.menuIconBox}>
              <GithubSVG className={cn(s.menuIcon, 'size-3')} />
            </div>
            <div className={s.menuTitle}>Github</div>
            <ArrowSVG className={s.linkArrow} />
          </Link>

          <div className={s.divider} />
          <Link className={s.menuItem} href='/apply/community'>
            <div className={s.menuIconBox}>
              <PlusSVG className={s.menuIcon} />
            </div>
            <div className={s.menuTitle}>新社区</div>
            <ArrowSVG className={s.linkArrow} />
          </Link>
        </div>
      }
      placement='bottom'
      hideOnClick={false}
      offset={[-3, -48]}
      trigger='click'
      onHide={() => setDisableTippyJump(false)}
      noPadding
    >
      <div className={s.wrapper} ref={ref}>
        <CommunityBrand />
        <OptionArrowSVG className={s.optionArrow} />
      </div>
    </Tooltip>
  )
}
