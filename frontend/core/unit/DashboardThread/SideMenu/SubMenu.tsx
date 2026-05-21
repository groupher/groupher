import Link from 'next/link'

import { DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import useTrans from '~/hooks/useTrans'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import useCommunity from '~/stores/community/hooks'

import ActiveMark from './ActiveMark'
import type { TSubMenuItem, TSubMenuScope } from './constant'
import useSalon, { cn } from './salon/doc'
import SubMenuBack from './SubMenuBack'

type TProps = {
  activeSlug: string | null
  baseRoute: string
  defaultSlug: string
  items: readonly TSubMenuItem[]
  returnTo: string | null
  scope: TSubMenuScope
}

export default function SubMenu({
  activeSlug: activeSlugProp,
  baseRoute,
  defaultSlug,
  items,
  returnTo,
  scope,
}: TProps) {
  const { slug: community } = useCommunity()
  const { subTab } = useDsbTab()
  const searchString = useURLSearchParams()
  const { t } = useTrans()
  const s = useSalon()

  const activeSlug = activeSlugProp ?? subTab ?? defaultSlug
  const dashboardBase = `/${community}/${DSB_ROUTE.OVERVIEW}`
  const sectionBase = `${dashboardBase}/${baseRoute}`
  const fallbackBackHref = `${dashboardBase}${searchString}`

  return (
    <div className={s.wrapper}>
      <SubMenuBack
        currentBase={sectionBase}
        dashboardBase={dashboardBase}
        fallbackHref={fallbackBackHref}
        returnTo={returnTo}
      />

      <div className={s.menu}>
        {items.map((item) => {
          const isActive = item.slug === activeSlug
          const path = item.path ? `/${item.path}` : ''

          return (
            <Link
              key={item.slug}
              className={cn(s.item, isActive && s.itemActive)}
              href={`${sectionBase}${path}${searchString}`}
            >
              {isActive && (
                <ActiveMark
                  scope={scope}
                  bgClassName={s.itemActiveBg}
                  barClassName={s.itemActiveBar}
                />
              )}
              <span className={s.itemLabel}>{t(item.title)}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
