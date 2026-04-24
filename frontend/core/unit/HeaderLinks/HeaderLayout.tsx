import Link from 'next/link'
import { startsWith } from 'ramda'
import { type FC, Fragment, useState } from 'react'
import { MORE_GROUP, ONE_LINK_GROUP } from '~/const/dashboard'
import useHeaderLinks from '~/hooks/useHeaderLinks'
import ArrowSVG from '~/icons/ArrowSimple'
import type { TLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import Tooltip from '~/widgets/Tooltip'
import useSalon, { cn } from './salon/header_layout'
import type { TLinkGroup, TProps } from './spec'

const LinkGroup: FC<TLinkGroup> = ({ groupTitle, links, showMoreFold, activePath }) => {
  const s = useSalon()

  const [menuOpen, setMenuOpen] = useState(false)
  const { slug } = useCommunity()

  if (!showMoreFold) return null

  // hideOnClick here is bug, not sure if it's caused by complex style of LinkItem
  return (
    <Tooltip
      content={
        <div className={s.menuPanel}>
          {links.map((item: TLinkItem) => {
            const active = `/${slug}/${activePath}` === item.link

            return (
              <Link
                key={item.index}
                href={item.link}
                className={cn(s.menuLink, active && s.menuLinkActive)}
              >
                {item.title}
              </Link>
            )
          })}
        </div>
      }
      onHide={() => setMenuOpen(false)}
      onShow={() => setMenuOpen(true)}
      hideOnClick={false}
      placement='bottom'
      offset={[8, 5]}
    >
      {/* @ts-ignore */}
      <div className={cn(s.link, s.groupItem, menuOpen && s.linkActive)}>
        {groupTitle === MORE_GROUP ? '更多' : groupTitle} <ArrowSVG className={s.arrowIcon} />
      </div>
    </Tooltip>
  )
}

const CustomHeaderLinks: FC<TProps> = ({ activePath = '' }) => {
  const s = useSalon()

  const { getGroupedLinks } = useHeaderLinks()
  const { groupedLinks, groupKeys } = getGroupedLinks()

  return (
    <div className={s.wrapper}>
      {groupKeys.map((groupTitle: string) => {
        const curGroupLinks = groupedLinks[groupTitle]

        if (curGroupLinks.length === 1 && curGroupLinks[0].title === '') return null

        return (
          <Fragment key={groupTitle}>
            {startsWith(ONE_LINK_GROUP, groupTitle) ? (
              <Link className={s.link} href={curGroupLinks[0].link}>
                {curGroupLinks[0].title}
              </Link>
            ) : (
              <LinkGroup
                groupTitle={groupTitle}
                links={curGroupLinks}
                activePath={activePath}
                showMoreFold={curGroupLinks.length > 0}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

export default CustomHeaderLinks
