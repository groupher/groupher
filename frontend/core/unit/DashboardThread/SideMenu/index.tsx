'use client'

import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import { keys } from 'ramda'
import { useEffect, useState } from 'react'

import useDsbTab from '~/hooks/useDsbTab'
import type { TDsbPath } from '~/spec'
import Sticky from '~/widgets/Sticky'

import { MENU, MENU_VIEW } from '../constant'
import useSalon from '../salon/side_menu'
import { getMenuDirection, menuVariants, type TMenuDirection } from './animation'
import { SUBMENU_CONFIG, SUBMENU_ROUTE_VIEW } from './constant'
import { DASHBOARD_MENU_VIEW_EVENT, type TMenuView, type TMenuViewEvent } from './events'
import Group from './Group'
import SubMenu from './SubMenu'

export default function SideMenu() {
  const s = useSalon()
  const { mainTab } = useDsbTab()
  const groupKeys = keys(MENU)
  const resolvedMenuView =
    SUBMENU_ROUTE_VIEW[mainTab as keyof typeof SUBMENU_ROUTE_VIEW] ?? MENU_VIEW.MAIN
  const [optimisticMenuView, setOptimisticMenuView] = useState<TMenuView | null>(null)
  const [optimisticSubTab, setOptimisticSubTab] = useState<string | null>(null)
  const [optimisticMainTab, setOptimisticMainTab] = useState<TDsbPath | null>(null)
  const [direction, setDirection] = useState<TMenuDirection>(() =>
    getMenuDirection(resolvedMenuView),
  )
  const [returnToByView, setReturnToByView] = useState<Partial<Record<TMenuView, string>>>({})
  const menuView = optimisticMenuView ?? resolvedMenuView
  const activeMainTab = (optimisticMainTab ?? mainTab) as TDsbPath

  useEffect(() => {
    // Once the router catches up, pathname becomes the source of truth again.
    // Clearing return targets outside their submenu prevents stale Back targets on later entries.
    setDirection(getMenuDirection(resolvedMenuView))
    setOptimisticSubTab(null)
    setOptimisticMainTab(null)
    setOptimisticMenuView(null)
    setReturnToByView((current) =>
      resolvedMenuView === MENU_VIEW.MAIN ? {} : { [resolvedMenuView]: current[resolvedMenuView] },
    )
  }, [mainTab, resolvedMenuView])

  useEffect(() => {
    const handleMenuView = (event: Event): void => {
      const {
        mainTab: nextMainTab,
        returnTo,
        subTab,
        view,
      } = (event as CustomEvent<TMenuViewEvent>).detail

      if (
        view === MENU_VIEW.MAIN ||
        Object.values(SUBMENU_ROUTE_VIEW).includes(
          view as (typeof SUBMENU_ROUTE_VIEW)[keyof typeof SUBMENU_ROUTE_VIEW],
        )
      ) {
        // Apply the target menu and active item immediately; route data may lag
        // behind on heavier sections, but the sidebar should still feel direct.
        if (returnTo) {
          setReturnToByView((current) => ({ ...current, [view]: returnTo }))
        }
        setOptimisticMainTab(nextMainTab ?? null)
        setOptimisticSubTab(subTab ?? null)
        setDirection(getMenuDirection(view))
        setOptimisticMenuView(view)
      }
    }

    window.addEventListener(DASHBOARD_MENU_VIEW_EVENT, handleMenuView)

    return () => window.removeEventListener(DASHBOARD_MENU_VIEW_EVENT, handleMenuView)
  }, [])

  return (
    <div className={s.wrapper}>
      <Sticky offsetTop={36}>
        <div className={s.menuStack}>
          <LazyMotion features={domAnimation}>
            <AnimatePresence initial={false} custom={direction}>
              <m.div
                key={menuView}
                className={s.menuLayer}
                custom={direction}
                variants={menuVariants}
                initial='initial'
                animate='animate'
                exit='exit'
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {menuView in SUBMENU_CONFIG ? (
                  <SubMenu
                    activeSlug={optimisticSubTab}
                    returnTo={returnToByView[menuView] ?? null}
                    {...SUBMENU_CONFIG[menuView as keyof typeof SUBMENU_CONFIG]}
                  />
                ) : (
                  groupKeys.map((key) => (
                    <Group key={key} activeMainTab={activeMainTab} group={MENU[key]} />
                  ))
                )}
              </m.div>
            </AnimatePresence>
          </LazyMotion>
        </div>
      </Sticky>
    </div>
  )
}
