import { useAutoAnimate } from '@formkit/auto-animate/react'
import Link from 'next/link'
import { type FC, Fragment } from 'react'

import { HEADER_LINK_TYPE } from '~/hooks/useHeaderLinks/constant'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import Tooltip from '~/widgets/Tooltip'

import { filterVisibleHeaderLinks, moreTabLinkTitle, moreTabTitle } from './helper'
import useSalon from './salon/header_template'
import type { TLinkGroup, TProps } from './spec'

const LinkGroup: FC<TLinkGroup> = ({ groupTitle, links, showMoreFold }) => {
  const s = useSalon()
  const { t } = useTrans()

  if (!showMoreFold) return null

  return (
    <Tooltip
      content={
        <div className={s.menuPanel}>
          {links.map((item) => (
            <Link className={s.linkItem} key={item.id} href={item.url}>
              {moreTabLinkTitle(item, t)}
            </Link>
          ))}
        </div>
      }
      placement='bottom'
      offset={[-5, 5]}
    >
      <div className={s.groupItem}>
        {groupTitle} <ArrowSVG className={s.arrowIcon} />
      </div>
    </Tooltip>
  )
}

const CustomHeaderLinks: FC<TProps> = ({ links = [] }) => {
  const s = useSalon()
  const { t } = useTrans()
  const [animateRef] = useAutoAnimate()
  const visibleLinks = filterVisibleHeaderLinks(links)

  return (
    <div className={s.wrapper} ref={animateRef}>
      {visibleLinks.map((item) => (
        <Fragment key={item.id}>
          {item.type === HEADER_LINK_TYPE.LINK ? (
            <Link className={s.linkItem} href={item.url}>
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
      ))}
    </div>
  )
}

export default CustomHeaderLinks
