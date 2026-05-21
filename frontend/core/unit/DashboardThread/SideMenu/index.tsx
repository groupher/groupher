'use client'

import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import { keys } from 'ramda'
import { useEffect, useReducer } from 'react'

import useDsbTab from '~/hooks/useDsbTab'
import type { TDsbPath } from '~/spec'
import Sticky from '~/widgets/Sticky'

import { MENU, MENU_VIEW } from '../constant'
import { getMenuDirection, menuVariants, type TMenuDirection } from './animation'
import { SUBMENU_CONFIG, SUBMENU_ROUTE_VIEW } from './constant'
import { DASHBOARD_MENU_VIEW_EVENT, type TMenuView, type TMenuViewEvent } from './events'
import Group from './Group'
import useSalon from './salon'
import SubMenu from './SubMenu'

type TSideMenuState = {
  direction: TMenuDirection
  optimisticMainTab: TDsbPath | null
  optimisticMenuView: TMenuView | null
  optimisticSubTab: string | null
  returnToByView: Partial<Record<TMenuView, string>>
}

type TSideMenuAction =
  | {
      resolvedMenuView: TMenuView
      type: 'syncRoute'
    }
  | {
      event: TMenuViewEvent
      type: 'applyMenuView'
    }

const submenuViews = Object.values(SUBMENU_ROUTE_VIEW) as TMenuView[]

const isMenuView = (view: TMenuView): boolean => {
  return view === MENU_VIEW.MAIN || submenuViews.includes(view)
}

const createInitialState = (resolvedMenuView: TMenuView): TSideMenuState => ({
  direction: getMenuDirection(resolvedMenuView),
  optimisticMainTab: null,
  optimisticMenuView: null,
  optimisticSubTab: null,
  returnToByView: {},
})

const sideMenuReducer = (state: TSideMenuState, action: TSideMenuAction): TSideMenuState => {
  switch (action.type) {
    case 'syncRoute': {
      const { resolvedMenuView } = action

      return {
        direction: getMenuDirection(resolvedMenuView),
        optimisticMainTab: null,
        optimisticMenuView: null,
        optimisticSubTab: null,
        returnToByView:
          resolvedMenuView === MENU_VIEW.MAIN
            ? {}
            : { [resolvedMenuView]: state.returnToByView[resolvedMenuView] },
      }
    }

    case 'applyMenuView': {
      const { mainTab, returnTo, subTab, view } = action.event

      if (!isMenuView(view)) return state

      return {
        direction: getMenuDirection(view),
        optimisticMainTab: mainTab ?? null,
        optimisticMenuView: view,
        optimisticSubTab: subTab ?? null,
        returnToByView: returnTo
          ? { ...state.returnToByView, [view]: returnTo }
          : state.returnToByView,
      }
    }
  }
}

export default function SideMenu() {
  const s = useSalon()
  const { mainTab } = useDsbTab()
  const groupKeys = keys(MENU)
  const resolvedMenuView =
    SUBMENU_ROUTE_VIEW[mainTab as keyof typeof SUBMENU_ROUTE_VIEW] ?? MENU_VIEW.MAIN
  const [state, dispatch] = useReducer(sideMenuReducer, resolvedMenuView, createInitialState)
  const { direction, optimisticMainTab, optimisticMenuView, optimisticSubTab, returnToByView } =
    state
  const menuView = optimisticMenuView ?? resolvedMenuView
  const activeMainTab = (optimisticMainTab ?? mainTab) as TDsbPath

  useEffect(() => {
    // Once the router catches up, pathname becomes the source of truth again.
    // Clearing return targets outside their submenu prevents stale Back targets on later entries.
    dispatch({ resolvedMenuView, type: 'syncRoute' })
  }, [mainTab, resolvedMenuView])

  useEffect(() => {
    const handleMenuView = (event: Event): void => {
      // Apply the target menu and active item immediately; route data may lag
      // behind on heavier sections, but the sidebar should still feel direct.
      dispatch({
        event: (event as CustomEvent<TMenuViewEvent>).detail,
        type: 'applyMenuView',
      })
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
