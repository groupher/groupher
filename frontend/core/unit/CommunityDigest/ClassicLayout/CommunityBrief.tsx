import { useEffect, useRef } from 'react'

import useHover from '~/hooks/useHover'
import ArrowSVG from '~/icons/ArrowUpRight'
import DiscussSVG from '~/icons/Discuss'
import GithubSVG from '~/icons/Github8'
import OptionArrowSVG from '~/icons/OptionArrow'
import PlusSVG from '~/icons/PlusCircle'
import GlobalSVG from '~/icons/social/Global'
import { Link } from '~/platform'
import useCommunity from '~/stores/community/hooks'
import useDsb from '~/stores/dsb/hooks'
import Tooltip from '~/ui/Tooltip'
import CommunityBrand from '~/unit/CommunityBrand'

import useSalon, { cn } from '../salon/classic_layout/community_brief'

export default function CommunityBrief() {
  const s = useSalon()

  const disableTippyJumpRef = useRef(false)
  const { slug } = useCommunity()
  const dsb$ = useDsb()

  const [ref, isHovering] = useHover<HTMLDivElement>()

  useEffect(() => {
    if (isHovering && !disableTippyJumpRef.current) {
      disableTippyJumpRef.current = true
    }
  }, [isHovering])

  return (
    <Tooltip
      content={
        <div className={s.panel}>
          <div className={s.brandPanel}>
            <CommunityBrand />
          </div>

          <Link
            navigation='router'
            className={cn(s.menuItem, 'hover:no-underline')}
            href={`/${slug}`}
          >
            <div className={s.menuIconBox}>
              <DiscussSVG className={s.menuIcon} />
            </div>

            <div className={s.menuTitle}>社区主页</div>
          </Link>

          <Link navigation='document' className={s.menuItem} href={dsb$.homepage}>
            <div className={s.menuIconBox}>
              <GlobalSVG className={s.menuIcon} />
            </div>
            <div className={s.menuTitle}>返回官网</div>
            <ArrowSVG className={s.linkArrow} />
          </Link>

          <Link navigation='router' className={s.menuItem} href={`/${slug}`}>
            <div className={s.menuIconBox}>
              <GithubSVG className={cn(s.menuIcon, 'size-3')} />
            </div>
            <div className={s.menuTitle}>Github</div>
            <ArrowSVG className={s.linkArrow} />
          </Link>

          <div className={s.divider} />
          <Link navigation='document' className={s.menuItem} href='/apply'>
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
      onHide={() => {
        disableTippyJumpRef.current = false
      }}
      noPadding
    >
      <div className={s.wrapper} ref={ref}>
        <CommunityBrand />
        <OptionArrowSVG className={s.optionArrow} />
      </div>
    </Tooltip>
  )
}
