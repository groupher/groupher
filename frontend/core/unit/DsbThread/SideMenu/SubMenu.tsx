import { useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import useDsbTab from '~/hooks/useDsbTab'
import useTrans from '~/hooks/useTrans'
import SidebarIcon from '~/icons/dsb/Sidebar'
import { dsbRoutes, Link, parseDsbPathname, resolveDsbRoute } from '~/platform'
import useCommunity from '~/stores/community/hooks'

import ActiveMark from './ActiveMark'
import type { TSubMenuItem, TSubMenuScope } from './constant'
import useSalon, { cnMerge } from './salon/doc'
import SubMenuBack from './SubMenuBack'

type TProps = {
  activeSlug: string | null
  baseRoute: string
  defaultSlug: string
  items: readonly TSubMenuItem[]
  endSlots?: Readonly<Partial<Record<string, ReactNode>>>
  onCollapse: () => void
  returnTo: string | null
  scope: TSubMenuScope
}

export default function SubMenu({
  activeSlug: activeSlugProp,
  baseRoute,
  defaultSlug,
  endSlots,
  items,
  onCollapse,
  returnTo,
  scope,
}: TProps) {
  const { slug: community } = useCommunity()
  const { pathname, searchStr } = useLocation()
  const searchParams = new URLSearchParams(searchStr)
  const { subTab } = useDsbTab()
  const meta = parseDsbPathname(pathname)
  const currentCommunity = meta?.community ?? community
  const { t } = useTrans()
  const s = useSalon()

  const activeSlug = activeSlugProp ?? subTab ?? defaultSlug
  const dashboardBase = resolveDsbRoute(dsbRoutes.overview({ community: currentCommunity }), {
    currentSearch: searchParams,
    preserveSearch: true,
  })
  const sectionBase = resolveDsbRoute(
    dsbRoutes.section({ community: currentCommunity, section: baseRoute }),
    {
      currentSearch: searchParams,
      preserveSearch: true,
    },
  )
  const fallbackBackHref = sectionBase

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <SubMenuBack
          currentBase={sectionBase}
          dashboardBase={dashboardBase}
          fallbackHref={fallbackBackHref}
          returnTo={returnTo}
        />
        <button
          type='button'
          className={s.collapseToggle}
          aria-label={t('dsb.aria.collapse_dashboard_submenu')}
          onClick={onCollapse}
        >
          <SidebarIcon className={s.collapseIcon} />
        </button>
      </div>

      <div className={s.menu}>
        {items.map((item) => {
          const isActive = item.slug === activeSlug
          const section = item.path ? `${baseRoute}/${item.path}` : baseRoute
          const route = dsbRoutes.section({
            community: currentCommunity,
            section,
          })
          const endSlot = endSlots?.[item.slug]

          return (
            <Link
              key={item.slug}
              route={route}
              navigation='router'
              className={cnMerge(s.item, isActive && s.itemActive)}
              aria-current={isActive ? 'page' : undefined}
              preserveSearch
            >
              {isActive && (
                <ActiveMark
                  scope={scope}
                  bgClassName={s.itemActiveBg}
                  barClassName={s.itemActiveBar}
                />
              )}
              <span className={s.itemLabel}>{t(item.title)}</span>
              {endSlot !== undefined && endSlot !== null && (
                <span className={s.itemEnd}>{endSlot}</span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
