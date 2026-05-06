import Link from 'next/link'
import { filter, keys, startsWith } from 'ramda'
import { type FC, Fragment, useState } from 'react'

import { MORE_GROUP, ONE_LINK_GROUP } from '~/const/dashboard'
import { groupByKey, sortByGroupIndex } from '~/helper'
import useNavActiveLayoutSalon from '~/hooks/useNavActiveLayoutSalon'
import ArrowSVG from '~/icons/ArrowSimple'
import LinkSVG from '~/icons/Link'
import MoreSVG from '~/icons/menu/MoreL'
import type { TLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from './salon/sidebar_layout'
import type { TLinkGroup, TProps } from './spec'

const LinkGroup: FC<TLinkGroup> = ({ groupTitle, links, showMoreFold, activePath }) => {
  const s = useSalon()
  const activeStyle = useNavActiveLayoutSalon()

  const [menuOpen, setMenuOpen] = useState(false)
  const { slug } = useCommunity()
  const isLinkActive = (link: string) => `/${slug}/${activePath}` === link
  const isGroupActive = links.some((item) => isLinkActive(item.link))

  if (!showMoreFold) return null

  return (
    <Tooltip
      content={
        <div className={s.menuPanel}>
          {links.map((item: TLinkItem) => {
            const active = isLinkActive(item.link)

            return (
              <Link
                key={item.index}
                className={cn(s.menuItem, active && activeStyle.item)}
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
      trigger='click'
      placement='bottom'
      offset={[-14, 5]}
    >
      {/* @ts-ignore */}
      <div className={cn(s.groupItem, (menuOpen || isGroupActive) && activeStyle.item)}>
        <MoreSVG className={cn(s.icon, (menuOpen || isGroupActive) && activeStyle.icon)} />
        {groupTitle === MORE_GROUP ? '更多' : groupTitle}{' '}
        <ArrowSVG
          className={cn(s.arrowIcon, (menuOpen || isGroupActive) && activeStyle.icon)}
        />
      </div>
    </Tooltip>
  )
}

const CustomHeaderLinks: FC<TProps> = ({ links, activePath = '' }) => {
  const s = useSalon()
  const activeStyle = useNavActiveLayoutSalon()
  const { slug } = useCommunity()

  const _links = filter((item) => item.title !== '', links)

  const groupedLinks = groupByKey(sortByGroupIndex(_links), 'group')
  const groupKeys = keys(groupedLinks)

  return (
    <div className={s.wrapper}>
      {groupKeys.map((groupTitle: string) => {
        const curGroupLinks = groupedLinks[groupTitle]
        if (curGroupLinks.length === 1 && curGroupLinks[0].title === '') return null

        return (
          <Fragment key={groupTitle}>
            {startsWith(ONE_LINK_GROUP, groupTitle) ? (
              <Link
                className={cn(
                  s.linkItem,
                  `/${slug}/${activePath}` === curGroupLinks[0].link && activeStyle.item,
                )}
                href={curGroupLinks[0].link}
              >
                <LinkSVG
                  className={cn(
                    s.icon,
                    'size-4',
                    `/${slug}/${activePath}` === curGroupLinks[0].link && activeStyle.icon,
                  )}
                />
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
