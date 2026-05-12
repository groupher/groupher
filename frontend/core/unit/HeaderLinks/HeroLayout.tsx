import Link from 'next/link'
import { type FC, Fragment, useState } from 'react'

import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import useHeaderLinks from '~/hooks/useHeaderLinks'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import LinkSVG from '~/icons/Link'
import Tooltip from '~/widgets/Tooltip'

import { filterVisibleHeaderLinks, moreTabLinkTitle, moreTabTitle } from './helper'
import useSalon, { cn } from './salon/hero_layout'
import type { TLinkGroup, TProps } from './spec'

const LinkGroup: FC<TLinkGroup> = ({ groupTitle, links, showMoreFold }) => {
  const s = useSalon()
  const { t } = useTrans()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!showMoreFold) return null

  return (
    <Tooltip
      content={
        <div className={s.menuPanel}>
          {links.map((item) => (
            <Link key={item.id} href={item.url} className={s.linkItem}>
              {moreTabLinkTitle(item, t)}
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
  const { t } = useTrans()
  const { getCustomLinks } = useHeaderLinks()
  const resolvedLinks = filterVisibleHeaderLinks(links ?? getCustomLinks())

  return (
    <div className={s.wrapper}>
      {resolvedLinks.map((item) => {
        return (
          <Fragment key={item.id}>
            {item.type === DASHBOARD_LINK_TYPE.LINK ? (
              <Link href={item.url} className={s.linkItem}>
                <LinkSVG className={cn(s.icon, 'size-4')} />
                {item.title}
              </Link>
            ) : (
              <LinkGroup
                groupTitle={moreTabTitle(item, t)}
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
