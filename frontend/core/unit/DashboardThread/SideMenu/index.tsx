'use client'

import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import { keys } from 'ramda'
import { useEffect, useState } from 'react'

import { DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import type { TDsbChangelogRoute, TDsbDocRoute, TDsbPath, TDsbPostRoute } from '~/spec'
import Sticky from '~/widgets/Sticky'

import { MENU, MENU_VIEW } from '../constant'
import useSalon from '../salon/side_menu'
import { getMenuDirection, menuVariants, type TMenuDirection } from './animation'
import ChangelogMenu from './ChangelogMenu'
import DocMenu from './DocMenu'
import { DASHBOARD_MENU_VIEW_EVENT, type TMenuView, type TMenuViewEvent } from './events'
import Group from './Group'
import PostMenu from './PostMenu'

export default function SideMenu() {
  const s = useSalon()
  const { mainTab } = useDsbTab()
  const groupKeys = keys(MENU)
  const resolvedMenuView =
    mainTab === DSB_ROUTE.DOC
      ? MENU_VIEW.DOC
      : mainTab === DSB_ROUTE.POST
        ? MENU_VIEW.POST
        : mainTab === DSB_ROUTE.CHANGELOG
          ? MENU_VIEW.CHANGELOG
          : MENU_VIEW.MAIN
  const [optimisticMenuView, setOptimisticMenuView] = useState<TMenuView | null>(null)
  const [optimisticDocSubTab, setOptimisticDocSubTab] = useState<TDsbDocRoute | null>(null)
  const [optimisticPostSubTab, setOptimisticPostSubTab] = useState<TDsbPostRoute | null>(null)
  const [optimisticChangelogSubTab, setOptimisticChangelogSubTab] =
    useState<TDsbChangelogRoute | null>(null)
  const [optimisticMainTab, setOptimisticMainTab] = useState<TDsbPath | null>(null)
  const [direction, setDirection] = useState<TMenuDirection>(() =>
    getMenuDirection(resolvedMenuView),
  )
  const [docReturnTo, setDocReturnTo] = useState<string | null>(null)
  const [postReturnTo, setPostReturnTo] = useState<string | null>(null)
  const [changelogReturnTo, setChangelogReturnTo] = useState<string | null>(null)
  const menuView = optimisticMenuView ?? resolvedMenuView
  const activeMainTab = (optimisticMainTab ?? mainTab) as TDsbPath

  useEffect(() => {
    // Once the router catches up, pathname becomes the source of truth again.
    // Clearing docReturnTo outside Docs prevents stale Back targets on later entries.
    setDirection(getMenuDirection(resolvedMenuView))
    setOptimisticDocSubTab(null)
    setOptimisticPostSubTab(null)
    setOptimisticChangelogSubTab(null)
    setOptimisticMainTab(null)
    setOptimisticMenuView(null)
    if (resolvedMenuView !== MENU_VIEW.DOC) setDocReturnTo(null)
    if (resolvedMenuView !== MENU_VIEW.POST) setPostReturnTo(null)
    if (resolvedMenuView !== MENU_VIEW.CHANGELOG) setChangelogReturnTo(null)
  }, [mainTab, resolvedMenuView])

  useEffect(() => {
    const handleMenuView = (event: Event): void => {
      const {
        changelogSubTab,
        docSubTab,
        mainTab: nextMainTab,
        postSubTab,
        returnTo,
        view,
      } = (event as CustomEvent<TMenuViewEvent>).detail

      if (
        view === MENU_VIEW.MAIN ||
        view === MENU_VIEW.DOC ||
        view === MENU_VIEW.POST ||
        view === MENU_VIEW.CHANGELOG
      ) {
        // Apply the target menu and active item immediately; route data may lag
        // behind on heavier sections, but the sidebar should still feel direct.
        if (returnTo) {
          if (view === MENU_VIEW.POST) setPostReturnTo(returnTo)
          else if (view === MENU_VIEW.CHANGELOG) setChangelogReturnTo(returnTo)
          else setDocReturnTo(returnTo)
        }
        setOptimisticMainTab(nextMainTab ?? null)
        setOptimisticDocSubTab(docSubTab ?? null)
        setOptimisticPostSubTab(postSubTab ?? null)
        setOptimisticChangelogSubTab(changelogSubTab ?? null)
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
                {menuView === MENU_VIEW.DOC ? (
                  <DocMenu activeSlug={optimisticDocSubTab} returnTo={docReturnTo} />
                ) : menuView === MENU_VIEW.POST ? (
                  <PostMenu activeSlug={optimisticPostSubTab} returnTo={postReturnTo} />
                ) : menuView === MENU_VIEW.CHANGELOG ? (
                  <ChangelogMenu
                    activeSlug={optimisticChangelogSubTab}
                    returnTo={changelogReturnTo}
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
