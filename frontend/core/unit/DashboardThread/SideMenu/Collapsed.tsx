'use client'

import { cnMerge } from '~/css'
import useDsbTab from '~/hooks/useDsbTab'
import useTrans from '~/hooks/useTrans'
import { dsbRoutes, Link as PlatformLink } from '~/platform'
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
  const { t } = useTrans()
  const currentCommunity = community
  const s = useSalon()
  const activeSlug = activeSlugProp ?? subTab ?? defaultSlug

  return (
    <div className={cnMerge(s.wrapper, className)}>
      <div className={s.menu} aria-label={t('dsb.aria.dashboard_menu')}>
        <button
          type='button'
          className={s.toggleItem}
          aria-label={t('dsb.aria.expand_dashboard_submenu')}
          onClick={onExpand}
        >
          <DsbMenuIcon type='sidebar' className={s.icon} />
        </button>

        <div className={s.group}>
          {items.map((item) => {
            const isActive = item.slug === activeSlug
            const title = t(item.title)
            const section = item.path ? `${baseRoute}/${item.path}` : baseRoute
            const target = dsbRoutes.section({
              community: currentCommunity,
              section,
            })

            return (
              <PlatformLink
                key={item.slug}
                route={target}
                className={cn(s.item, isActive && s.itemActive)}
                title={title}
                aria-label={title}
                aria-current={isActive ? 'page' : undefined}
                preserveSearch
                onClick={() => {
                  dispatchMenuView({
                    subTab: item.slug,
                    view,
                  })
                }}
              >
                <DsbMenuIcon type={item.icon} className={s.icon} />
              </PlatformLink>
            )
          })}
        </div>
      </div>
    </div>
  )
}
