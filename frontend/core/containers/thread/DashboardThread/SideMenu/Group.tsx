import Link from 'next/link'
import { type FC, useState } from 'react'

import { DSB_ROUTE } from '~/const/route'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'

import ArrowSVG from '~/icons/ArrowSimple'
import BindSVG from '~/icons/Bind'
import InfoSVG from '~/icons/Info'
import ManagementSVG from '~/icons/Management'
import PulseSVG from '~/icons/Pulse'
import useSalon, { cn } from '../salon/side_menu/group'
import type { TMenuGroup } from '../spec'

type TProps = {
  group: TMenuGroup
}

const Group: FC<TProps> = ({ group }) => {
  const { menuTab } = useDashboard()

  const { slug: community } = useCommunity()
  const [fold, setFold] = useState(group.initFold)

  const s = useSalon({ fold })

  return (
    <div className={s.wrapper}>
      <button className={s.folder} onClick={() => setFold(!fold)}>
        <div className={s.iconBox}>
          {group.icon === 'basic' && <InfoSVG className={s.menuIcon} />}
          {group.icon === 'cms' && <ManagementSVG className={cn(s.menuIcon, 'size-4 -mt-px')} />}
          {group.icon === 'analysis' && <PulseSVG className={s.menuIcon} />}
          {group.icon === 'bind' && <BindSVG className={s.menuIcon} />}
        </div>
        <h3 className={s.title}>{group.title}</h3>
        <ArrowSVG className={s.arrowIcon} />
      </button>

      {!fold && (
        <div className={s.menu}>
          {group.children.map((item) => {
            const subPath = item.slug === DSB_ROUTE.OVERVIEW ? '' : item.slug
            const isActive = item.slug === menuTab

            return (
              <Link
                key={item.slug}
                className={cn(s.item, isActive && s.itemActive)}
                href={`/${community}/${DSB_ROUTE.OVERVIEW}/${subPath}`}
              >
                {isActive && <div className={s.itemActiveBar} />}

                {item.title}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Group
