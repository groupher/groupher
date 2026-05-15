import Link from 'next/link'

import { DSB_DOC_ROUTE, DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import useTrans from '~/hooks/useTrans'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import type { TDsbDocRoute } from '~/spec'
import useCommunity from '~/stores/community/hooks'

import useSalon, { cn } from '../salon/side_menu/doc'
import ActiveMark from './ActiveMark'
import { DOC_MENU_ITEMS } from './constant'
import SubMenuBack from './SubMenuBack'

type TProps = {
  activeSlug: TDsbDocRoute | null
  returnTo: string | null
}

export default function DocMenu({ activeSlug: activeSlugProp, returnTo }: TProps) {
  const { slug: community } = useCommunity()
  const { subTab } = useDsbTab()
  const searchString = useURLSearchParams()
  const { t } = useTrans()
  const s = useSalon()

  const activeSlug = activeSlugProp ?? subTab ?? DSB_DOC_ROUTE.LAYOUT
  const dashboardBase = `/${community}/${DSB_ROUTE.OVERVIEW}`
  const docBase = `/${community}/${DSB_ROUTE.OVERVIEW}/${DSB_ROUTE.DOC}`
  const fallbackBackHref = `${dashboardBase}${searchString}`

  return (
    <div className={s.wrapper}>
      <SubMenuBack
        currentBase={docBase}
        dashboardBase={dashboardBase}
        fallbackHref={fallbackBackHref}
        returnTo={returnTo}
      />

      <div className={s.menu}>
        {DOC_MENU_ITEMS.map((item) => {
          const isActive = item.slug === activeSlug
          const path = item.path ? `/${item.path}` : ''

          return (
            <Link
              key={item.slug}
              className={cn(s.item, isActive && s.itemActive)}
              href={`${docBase}${path}${searchString}`}
            >
              {isActive && (
                <ActiveMark
                  scope='doc'
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
