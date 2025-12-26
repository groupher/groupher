import { useAutoAnimate } from '@formkit/auto-animate/react'
import Link from 'next/link'
import { keys, startsWith } from 'ramda'
import { type FC, Fragment } from 'react'
import { MORE_GROUP, ONE_LINK_GROUP } from '~/const/dashboard'
import { groupByKey, sortByIndex } from '~/helper'
import ArrowSVG from '~/icons/ArrowSimple'
import type { TLinkItem } from '~/spec'
import Tooltip from '~/widgets/Tooltip'
import useSalon from './salon/header_template'
import type { TLinkGroup, TProps } from './spec'

const LinkGroup: FC<TLinkGroup> = ({ groupTitle, links, showMoreFold }) => {
  const s = useSalon()

  if (!showMoreFold) return null

  return (
    <Tooltip
      content={
        <div className={s.menuPanel}>
          {links.map((item: TLinkItem) => (
            <Link className={s.linkItem} key={item.index} href={item.link}>
              {item.title}
            </Link>
          ))}
        </div>
      }
      placement='bottom'
      offset={[-5, 5]}
    >
      <div className={s.groupItem}>
        {groupTitle === MORE_GROUP ? '更多' : groupTitle} <ArrowSVG className={s.arrowIcon} />
      </div>
    </Tooltip>
  )
}

const CustomHeaderLinks: FC<TProps> = ({ links }) => {
  const s = useSalon()

  const [animateRef] = useAutoAnimate()

  const groupedLinks = groupByKey(sortByIndex(links, 'groupIndex'), 'group')
  const groupKeys = keys(groupedLinks)

  return (
    <div className={s.wrapper} ref={animateRef}>
      {groupKeys.map((groupTitle: string) => {
        const curGroupLinks = groupedLinks[groupTitle]

        if (curGroupLinks.length === 1 && curGroupLinks[0].title === '') return null

        return (
          <Fragment key={groupTitle}>
            {startsWith(ONE_LINK_GROUP, groupTitle) ? (
              <Link className={s.linkItem} href={curGroupLinks[0].link}>
                {curGroupLinks[0].title}
              </Link>
            ) : (
              <LinkGroup
                groupTitle={groupTitle}
                links={curGroupLinks}
                showMoreFold={links.length >= 2 && links[0].title !== ''}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

export default CustomHeaderLinks
