import Link from 'next/link'

import { DSB_CHANGELOG_ROUTE, DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import useTrans from '~/hooks/useTrans'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import type { TDsbChangelogRoute } from '~/spec'
import useCommunity from '~/stores/community/hooks'

import useSalon, { cn } from '../salon/side_menu/doc'
import ActiveMark from './ActiveMark'
import { CHANGELOG_MENU_ITEMS } from './constant'
import SubMenuBack from './SubMenuBack'

type TProps = {
  activeSlug: TDsbChangelogRoute | null
  returnTo: string | null
}

export default function ChangelogMenu({ activeSlug: activeSlugProp, returnTo }: TProps) {
  const { slug: community } = useCommunity()
  const { subTab } = useDsbTab()
  const searchString = useURLSearchParams()
  const { t } = useTrans()
  const s = useSalon()

  const activeSlug = activeSlugProp ?? subTab ?? DSB_CHANGELOG_ROUTE.CONTENT
  const dashboardBase = `/${community}/${DSB_ROUTE.OVERVIEW}`
  const changelogBase = `/${community}/${DSB_ROUTE.OVERVIEW}/${DSB_ROUTE.CHANGELOG}`
  const fallbackBackHref = `${dashboardBase}${searchString}`

  return (
    <div className={s.wrapper}>
      <SubMenuBack
        currentBase={changelogBase}
        dashboardBase={dashboardBase}
        fallbackHref={fallbackBackHref}
        returnTo={returnTo}
      />

      <div className={s.menu}>
        {CHANGELOG_MENU_ITEMS.map((item) => {
          const isActive = item.slug === activeSlug
          const path = item.path ? `/${item.path}` : ''

          return (
            <Link
              key={item.slug}
              className={cn(s.item, isActive && s.itemActive)}
              href={`${changelogBase}${path}${searchString}`}
            >
              {isActive && (
                <ActiveMark
                  scope='changelog'
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
