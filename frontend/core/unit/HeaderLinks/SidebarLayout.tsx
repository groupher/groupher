import Link from 'next/link'
import { type FC, Fragment, useState } from 'react'

import useHeaderLinks from '~/hooks/useHeaderLinks'
import useNavActiveLayoutSalon from '~/hooks/useNavActiveLayoutSalon'
import ArrowSVG from '~/icons/ArrowSimple'
import LinkSVG from '~/icons/Link'
import MoreSVG from '~/icons/menu/MoreL'
import useCommunity from '~/stores/community/hooks'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from './salon/sidebar_layout'
import type { TLinkGroup, TProps } from './spec'

const LinkGroup: FC<TLinkGroup> = ({ groupTitle, links, showMoreFold, activePath }) => {
  const s = useSalon()
  const activeStyle = useNavActiveLayoutSalon()

  const [menuOpen, setMenuOpen] = useState(false)
  const { slug } = useCommunity()
  const isLinkActive = (url: string) => `/${slug}/${activePath}` === url
  const isGroupActive = links.some((item) => isLinkActive(item.url))

  if (!showMoreFold) return null

  return (
    <Tooltip
      content={
        <div className={s.menuPanel}>
          {links.map((item) => {
            const active = isLinkActive(item.url)

            return (
              <Link
                key={item.id}
                className={cn(s.menuItem, active && activeStyle.item)}
                href={item.url}
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
  const resolvedLinks = links ?? getCustomLinks()

  return (
    <div className={s.wrapper}>
      {resolvedLinks.map((item) => {
        return (
          <Fragment key={item.id}>
            {item.type === 'LINK' ? (
              <Link
                className={cn(
                  s.linkItem,
                  `/${slug}/${activePath}` === item.url && activeStyle.item,
                )}
                href={item.url}
              >
                <LinkSVG
                  className={cn(
                    s.icon,
                    'size-4',
                    `/${slug}/${activePath}` === item.url && activeStyle.icon,
                  )}
                />
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
