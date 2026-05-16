import Link from 'next/link'

import { DSB_POST_ROUTE, DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import useTrans from '~/hooks/useTrans'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import type { TDsbPostRoute } from '~/spec'
import useCommunity from '~/stores/community/hooks'

import useSalon, { cn } from '../salon/side_menu/doc'
import ActiveMark from './ActiveMark'
import { POST_MENU_ITEMS } from './constant'
import SubMenuBack from './SubMenuBack'

type TProps = {
  activeSlug: TDsbPostRoute | null
  returnTo: string | null
}

export default function PostMenu({ activeSlug: activeSlugProp, returnTo }: TProps) {
  const { slug: community } = useCommunity()
  const { subTab } = useDsbTab()
  const searchString = useURLSearchParams()
  const { t } = useTrans()
  const s = useSalon()

  const activeSlug = activeSlugProp ?? subTab ?? DSB_POST_ROUTE.CONTENT
  const dashboardBase = `/${community}/${DSB_ROUTE.OVERVIEW}`
  const postBase = `/${community}/${DSB_ROUTE.OVERVIEW}/${DSB_ROUTE.POST}`
  const fallbackBackHref = `${dashboardBase}${searchString}`

  return (
    <div className={s.wrapper}>
      <SubMenuBack
        currentBase={postBase}
        dashboardBase={dashboardBase}
        fallbackHref={fallbackBackHref}
        returnTo={returnTo}
      />

      <div className={s.menu}>
        {POST_MENU_ITEMS.map((item) => {
          const isActive = item.slug === activeSlug
          const path = item.path ? `/${item.path}` : ''

          return (
            <Link
              key={item.slug}
              className={cn(s.item, isActive && s.itemActive)}
              href={`${postBase}${path}${searchString}`}
            >
              {isActive && (
                <ActiveMark
                  scope='post'
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
