'use client'

import Link from 'next/link'

import { DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import useTrans from '~/hooks/useTrans'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import DsbIcon from '~/icons/dsb'
import type { TDsbPath } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import Sticky from '~/widgets/Sticky'

import { MENU, MENU_VIEW } from '../constant'
import type { TDsbMenuGroup } from '../spec'
import { SUBMENU_CONFIG, SUBMENU_ROUTE_VIEW } from './constant'
import { dispatchMenuView, type TMenuView } from './events'
import useSalon, { cn } from './salon/collapsed'

type TProps = {
  className?: string
}

export default function Collapsed({ className }: TProps) {
  const { slug: community } = useCommunity()
  const { mainTab } = useDsbTab()
  const searchString = useURLSearchParams()
  const { t } = useTrans()
  const s = useSalon()
  const groups = Object.entries(MENU) as Array<[string, TDsbMenuGroup]>

  return (
    <div className={cn(s.wrapper, className)}>
      <Sticky offsetTop={36}>
        <div className={s.menu} aria-label='Dashboard menu'>
          {groups.map(([key, group]) => (
            <div key={key} className={s.group}>
              {group.children.map((item) => {
                const submenuView = SUBMENU_ROUTE_VIEW[item.slug as keyof typeof SUBMENU_ROUTE_VIEW]
                const submenuConfig = submenuView ? SUBMENU_CONFIG[submenuView] : null
                const subPath = item.slug === DSB_ROUTE.OVERVIEW ? '' : item.slug
                const itemPath = submenuConfig?.entryPath ?? subPath
                const isActive = item.slug === mainTab
                const title = t(item.title)

                return (
                  <Link
                    key={item.slug}
                    className={cn(s.item, isActive && s.itemActive)}
                    href={`/${community}/${DSB_ROUTE.OVERVIEW}/${itemPath}${searchString}`}
                    title={title}
                    aria-label={title}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      if (submenuConfig) {
                        dispatchMenuView({
                          subTab: submenuConfig.entrySlug,
                          returnTo: `${window.location.pathname}${searchString}`,
                          view: submenuView as TMenuView,
                        })
                      } else {
                        dispatchMenuView({
                          mainTab: item.slug as TDsbPath,
                          view: MENU_VIEW.MAIN,
                        })
                      }
                    }}
                  >
                    <DsbIcon type={item.icon} className={s.icon} />
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </Sticky>
    </div>
  )
}
