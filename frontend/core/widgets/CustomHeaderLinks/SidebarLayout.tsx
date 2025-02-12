import { type FC, Fragment, useState } from 'react'
import Link from 'next/link'
import { keys, startsWith, filter } from 'ramda'

import type { TLinkItem } from '~/spec'
import { MORE_GROUP, ONE_LINK_GROUP } from '~/const/dashboard'
import { sortByIndex, groupByKey } from '~/helper'
import useAccount from '~/hooks/useAccount'
import useViewingCommunity from '~/hooks/useViewingCommunity'

import MoreSVG from '~/icons/menu/MoreL'
import LinkSVG from '~/icons/Link'
import ArrowSVG from '~/icons/ArrowSimple'
import Tooltip from '~/widgets/Tooltip'

import type { TProps, TLinkGroup } from './spec'

import useSalon, { cn } from './salon/sidebar_layout'

const LinkGroup: FC<TLinkGroup> = ({ groupTitle, links, showMoreFold, activePath }) => {
  const s = useSalon()

  const [menuOpen, setMenuOpen] = useState(false)
  const { slug } = useViewingCommunity()

  if (!showMoreFold) return null

  return (
    <Tooltip
      content={
        <div className={s.menuPanel}>
          {links.map((item: TLinkItem) => {
            const active = `/${slug}/${activePath}` === item.link

            return (
              <Link
                key={item.index}
                className={cn(s.menuItem, active && s.menuItemActive)}
                href={item.link}
              >
                {item.title}
              </Link>
            )
          })}
        </div>
      }
      onHide={() => setMenuOpen(false)}
      onShow={() => setMenuOpen(true)}
      trigger="click"
      placement="bottom"
      offset={[-14, 5]}
    >
      {/* @ts-ignore */}
      <div className={cn(s.groupItem, menuOpen && s.groupItemActive)}>
        <MoreSVG className={s.icon} />
        {groupTitle === MORE_GROUP ? '更多' : groupTitle} <ArrowSVG className={s.arrowIcon} />
      </div>
    </Tooltip>
  )
}

const CustomHeaderLinks: FC<TProps> = ({ links, activePath = '' }) => {
  const s = useSalon()

  const { isModerator } = useAccount()

  const _links = filter((item) => item.title !== '', links)

  // @ts-ignore
  const groupedLinks = groupByKey(sortByIndex(_links, 'groupIndex'), 'group')
  const groupKeys = keys(groupedLinks)

  return (
    <div className={s.wrapper}>
      {groupKeys.map((groupTitle: string) => {
        const curGroupLinks = groupedLinks[groupTitle]
        if (curGroupLinks.length === 1 && curGroupLinks[0].title === '') return null

        return (
          <Fragment key={groupTitle}>
            {startsWith(ONE_LINK_GROUP, groupTitle) ? (
              <Link className={s.linkItem} href={curGroupLinks[0].link}>
                <LinkSVG className={cn(s.icon, 'size-4')} />
                {curGroupLinks[0].title}
              </Link>
            ) : (
              <LinkGroup
                groupTitle={groupTitle}
                links={curGroupLinks}
                activePath={activePath}
                showMoreFold={(links.length >= 2 && links[0].title !== '') || isModerator}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

export default CustomHeaderLinks
