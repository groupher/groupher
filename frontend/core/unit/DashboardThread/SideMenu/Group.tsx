import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type FC, useState } from 'react'

import { DSB_ROUTE } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import ArrowSVG from '~/icons/ArrowSimple'
import BindSVG from '~/icons/Bind'
import InfoSVG from '~/icons/Info'
import ManagementSVG from '~/icons/Management'
import PulseSVG from '~/icons/Pulse'
import type { TDsbPath } from '~/spec'
import useCommunity from '~/stores/community/hooks'

import { DSB_MENU_ICON, MENU_VIEW } from '../constant'
import useSalon, { cn } from '../salon/side_menu/group'
import type { TDsbMenuGroup } from '../spec'
import ActiveMark from './ActiveMark'
import { SUBMENU_CONFIG, SUBMENU_ROUTE_VIEW } from './constant'
import { dispatchMenuView, type TMenuView } from './events'

type TProps = {
  activeMainTab: TDsbPath
  group: TDsbMenuGroup
}

const Group: FC<TProps> = ({ activeMainTab, group }) => {
  const { slug: community } = useCommunity()
  const pathname = usePathname()
  const searchString = useURLSearchParams()
  const [foldState, setFoldState] = useState<boolean | null>(null)
  const fold = foldState ?? group.initFold
  const { t } = useTrans()

  const s = useSalon({ fold })

  return (
    <div className={s.wrapper}>
      <div className={s.folder}>
        <Link
          className={s.folderLink}
          href={`/${community}/${DSB_ROUTE.OVERVIEW}/${group.overviewSlug}${searchString}`}
        >
          <div className={s.iconBox}>
            {group.icon === DSB_MENU_ICON.BASIC && <InfoSVG className={s.menuIcon} />}
            {group.icon === DSB_MENU_ICON.CMS && (
              <ManagementSVG className={cn(s.menuIcon, 'size-4 -mt-px')} />
            )}
            {group.icon === DSB_MENU_ICON.ANALYSIS && <PulseSVG className={s.menuIcon} />}
            {group.icon === DSB_MENU_ICON.BIND && <BindSVG className={s.menuIcon} />}
          </div>
          <h3 className={s.title}>{t(group.title)}</h3>
        </Link>
        <button
          type='button'
          className={s.foldBtn}
          aria-label={fold ? t('tags.fold.expand') : t('tags.fold.collapse')}
          aria-expanded={!fold}
          onClick={() => setFoldState(!fold)}
        >
          <ArrowSVG className={s.arrowIcon} />
        </button>
      </div>

      {!fold && (
        <div className={s.menu}>
          {group.children.map((item) => {
            const subPath = item.slug === DSB_ROUTE.OVERVIEW ? '' : item.slug
            const submenuView = SUBMENU_ROUTE_VIEW[item.slug as keyof typeof SUBMENU_ROUTE_VIEW]
            const submenuConfig = submenuView ? SUBMENU_CONFIG[submenuView] : null
            const itemPath = submenuConfig?.entryPath ?? subPath
            const isActive = item.slug === activeMainTab

            return (
              <Link
                key={item.slug}
                className={cn(s.item, isActive && s.itemActive)}
                href={`/${community}/${DSB_ROUTE.OVERVIEW}/${itemPath}${searchString}`}
                onClick={() => {
                  if (submenuConfig) {
                    dispatchMenuView({
                      subTab: submenuConfig.entrySlug,
                      returnTo: `${pathname}${searchString}`,
                      view: submenuView as TMenuView,
                    })
                  } else {
                    dispatchMenuView({
                      mainTab: item.slug,
                      view: MENU_VIEW.MAIN,
                    })
                  }
                }}
              >
                {isActive && (
                  <ActiveMark
                    scope='main'
                    bgClassName={s.itemActiveBg}
                    barClassName={s.itemActiveBar}
                  />
                )}

                <span className={s.itemLabel}>{t(item.title)}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Group
