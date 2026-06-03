'use client'

import Link from 'next/link'

import { DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import useTrans from '~/hooks/useTrans'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import useCommunity from '~/stores/community/hooks'

import { MENU_VIEW } from '../constant'
import type { TSubMenuItem } from './constant'
import { dispatchMenuView, type TMenuView } from './events'
import DsbMenuIcon from './icons'
import useSalon, { cn } from './salon/collapsed'

type TProps = {
  activeSlug: string | null
  baseRoute: string
  className?: string
  defaultSlug: string
  items: readonly TSubMenuItem[]
  onExpand: () => void
  view: Exclude<TMenuView, `${MENU_VIEW.MAIN}`>
}

export default function Collapsed({
  activeSlug: activeSlugProp,
  baseRoute,
  className,
  defaultSlug,
  items,
  onExpand,
  view,
}: TProps) {
  const { slug: community } = useCommunity()
  const { subTab } = useDsbTab()
  const searchString = useURLSearchParams()
  const { t } = useTrans()
  const s = useSalon()
  const dashboardBase = `/${community}/${DSB_ROUTE.OVERVIEW}`
  const sectionBase = `${dashboardBase}/${baseRoute}`
  const activeSlug = activeSlugProp ?? subTab ?? defaultSlug

  return (
    <div className={cn(s.wrapper, className)}>
      <div className={s.menu} aria-label='Dashboard menu'>
        <button
          type='button'
          className={s.toggleItem}
          aria-label='Expand dashboard submenu'
          onClick={onExpand}
        >
          <DsbMenuIcon type='sidebar' className={s.icon} />
        </button>

        <div className={s.group}>
          {items.map((item) => {
            const path = item.path ? `/${item.path}` : ''
            const isActive = item.slug === activeSlug
            const title = t(item.title)

            return (
              <Link
                key={item.slug}
                className={cn(s.item, isActive && s.itemActive)}
                href={`${sectionBase}${path}${searchString}`}
                title={title}
                aria-label={title}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  dispatchMenuView({
                    subTab: item.slug,
                    view,
                  })
                }}
              >
                <DsbMenuIcon type={item.icon} className={s.icon} />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
