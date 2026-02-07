import Link from 'next/link'
import { type FC, useState } from 'react'
import { DSB_ROUTE } from '~/const/route'
import useCommunity from '~/hooks/useCommunity'
import useDsbTab from '~/hooks/useDsbTab'
import useTrans from '~/hooks/useTrans'
import useURLSearchParams from '~/hooks/useURLSearchParams'

import ArrowSVG from '~/icons/ArrowSimple'
import BindSVG from '~/icons/Bind'
import InfoSVG from '~/icons/Info'
import ManagementSVG from '~/icons/Management'
import PulseSVG from '~/icons/Pulse'
import useSalon, { cn } from '../salon/side_menu/group'
import type { TDsbMenuGroup } from '../spec'

type TProps = {
  group: TDsbMenuGroup
}

const Group: FC<TProps> = ({ group }) => {
  const { mainTab } = useDsbTab()

  const { slug: community } = useCommunity()
  const searchString = useURLSearchParams()
  const [fold, setFold] = useState(group.initFold)
  const { t } = useTrans()

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
        <h3 className={s.title}>{t(group.title)}</h3>
        <ArrowSVG className={s.arrowIcon} />
      </button>

      {!fold && (
        <div className={s.menu}>
          {group.children.map((item) => {
            const subPath = item.slug === DSB_ROUTE.OVERVIEW ? '' : item.slug
            const isActive = item.slug === mainTab

            return (
              <Link
                key={item.slug}
                className={cn(s.item, isActive && s.itemActive)}
                href={`/${community}/${DSB_ROUTE.OVERVIEW}/${subPath}${searchString}`}
              >
                {isActive && <div className={s.itemActiveBar} />}

                {t(item.title)}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Group
