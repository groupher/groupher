import Link from 'next/link'
import { type FC, Fragment, useState } from 'react'

import useHeaderLinks from '~/hooks/useHeaderLinks'
import useNavActiveLayoutSalon from '~/hooks/useNavActiveLayoutSalon'
import ArrowSVG from '~/icons/ArrowSimple'
import useCommunity from '~/stores/community/hooks'
import Tooltip from '~/widgets/Tooltip'

import { filterVisibleHeaderLinks, isHeaderLinkActive } from './helper'
import useSalon, { cn } from './salon/classic_layout'
import type { TLinkGroup, TProps } from './spec'

const LinkGroup: FC<TLinkGroup> = ({ groupTitle, links, showMoreFold, activePath }) => {
  const s = useSalon()
  const activeStyle = useNavActiveLayoutSalon()

  const [menuOpen, setMenuOpen] = useState(false)
  const { slug } = useCommunity()
  const isLinkActive = (url: string) => isHeaderLinkActive(slug, activePath || '', url)
  const isGroupActive = links.some((item) => isLinkActive(item.url))

  if (!showMoreFold) return null

  // hideOnClick here is bug, not sure if it's caused by complex style of LinkItem
  return (
    <Tooltip
      content={
        <div className={s.menuPanel}>
          {links.map((item) => {
            const active = isLinkActive(item.url)

            return (
              <Link
                key={item.id}
                href={item.url}
                className={cn(s.menuLink, active && activeStyle.item)}
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
      <div className={cn(s.link, s.groupItem, (menuOpen || isGroupActive) && activeStyle.item)}>
        {groupTitle}{' '}
        <ArrowSVG className={cn(s.arrowIcon, (menuOpen || isGroupActive) && activeStyle.icon)} />
      </div>
    </Tooltip>
  )
}

const CustomHeaderLinks: FC<TProps> = ({ links, activePath = '' }) => {
  const s = useSalon()
  const activeStyle = useNavActiveLayoutSalon()
  const { slug } = useCommunity()

  const { getCustomLinks } = useHeaderLinks()
  const resolvedLinks = filterVisibleHeaderLinks(links ?? getCustomLinks())

  return (
    <div className={s.wrapper}>
      {resolvedLinks.map((item) => {
        return (
          <Fragment key={item.id}>
            {item.type === 'LINK' ? (
              <Link
                className={cn(
                  s.link,
                  isHeaderLinkActive(slug, activePath, item.url) && activeStyle.item,
                )}
                href={item.url}
              >
                {item.title}
              </Link>
            ) : (
              <LinkGroup
                groupTitle={item.title}
                links={item.links}
                activePath={activePath}
                showMoreFold={item.links.length > 0}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

export default CustomHeaderLinks
