import Link from 'next/link'
import { type FC, Fragment, useState } from 'react'

import useHeaderLinks from '~/hooks/useHeaderLinks'
import ArrowSVG from '~/icons/ArrowSimple'
import LinkSVG from '~/icons/Link'
import Tooltip from '~/widgets/Tooltip'

import { filterVisibleHeaderLinks } from './helper'
import useSalon, { cn } from './salon/hero_layout'
import type { TLinkGroup, TProps } from './spec'

const LinkGroup: FC<TLinkGroup> = ({ groupTitle, links, showMoreFold }) => {
  const s = useSalon()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!showMoreFold) return null

  return (
    <Tooltip
      content={
        <div className={s.menuPanel}>
          {links.map((item) => (
            <Link key={item.id} href={item.url} className={s.linkItem}>
              {item.title}
            </Link>
          ))}
        </div>
      }
      onHide={() => setMenuOpen(false)}
      onShow={() => setMenuOpen(true)}
      trigger='click'
      placement='bottom'
      offset={[8, 5]}
    >
      <div className={cn(s.groupItem, menuOpen && s.groupItemActive)}>
        {groupTitle} <ArrowSVG className={s.arrowIcon} />
      </div>
    </Tooltip>
  )
}

const CustomHeaderLinks: FC<TProps> = ({ links }) => {
  const s = useSalon()
  const { getCustomLinks } = useHeaderLinks()
  const resolvedLinks = filterVisibleHeaderLinks(links ?? getCustomLinks())

  return (
    <div className={s.wrapper}>
      {resolvedLinks.map((item) => {
        return (
          <Fragment key={item.id}>
            {item.type === 'LINK' ? (
              <Link href={item.url} className={s.linkItem}>
                <LinkSVG className={cn(s.icon, 'size-4')} />
                {item.title}
              </Link>
            ) : (
              <LinkGroup
                groupTitle={item.title}
                links={item.links}
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
