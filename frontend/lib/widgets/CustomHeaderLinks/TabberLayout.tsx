import { type FC, Fragment, useState } from 'react'
import { keys, startsWith, filter } from 'ramda'
import Link from 'next/link'

import type { TLinkItem } from '~/spec'
import { MORE_GROUP, ONE_LINK_GROUP } from '~/const/dashboard'
import { sortByIndex, groupByKey } from '~/helper'
import useAccount from '~/hooks/useAccount'

import ArrowSVG from '~/icons/ArrowSimple'
import LinkSVG from '~/icons/Link'
import Tooltip from '~/widgets/Tooltip'

import type { TProps, TLinkGroup } from './spec'

import useSalon, { cn } from './salon/tabber_layout'

const LinkGroup: FC<TLinkGroup> = ({ groupTitle, links, showMoreFold }) => {
  const s = useSalon()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!showMoreFold) return null

  return (
    <Tooltip
      content={
        <div className={s.menuPanel}>
          {links.map((item: TLinkItem) => (
            <Link key={item.index} href={item.link} className={s.linkItem}>
              {item.title}
            </Link>
          ))}
        </div>
      }
      onHide={() => setMenuOpen(false)}
      onShow={() => setMenuOpen(true)}
      trigger="click"
      placement="bottom"
      offset={[8, 5]}
    >
      <div className={cn(s.groupItem, menuOpen && s.groupItemActive)}>
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
              <Link href={curGroupLinks[0].link} className={s.linkItem}>
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
