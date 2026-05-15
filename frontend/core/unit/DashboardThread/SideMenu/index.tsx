'use client'

import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import { keys } from 'ramda'

import { DSB_ROUTE } from '~/const/route'
import useDsbTab from '~/hooks/useDsbTab'
import Sticky from '~/widgets/Sticky'

import { MENU, MENU_VIEW } from '../constant'
import useSalon from '../salon/side_menu'
import DocMenu from './DocMenu'
import Group from './Group'

export default function SideMenu() {
  const s = useSalon()
  const { mainTab } = useDsbTab()
  const groupKeys = keys(MENU)
  const menuView = mainTab === DSB_ROUTE.DOC ? MENU_VIEW.DOC : MENU_VIEW.MAIN

  return (
    <div className={s.wrapper}>
      <Sticky offsetTop={36}>
        <LazyMotion features={domAnimation}>
          <AnimatePresence mode='wait' initial={false}>
            <m.div
              key={menuView}
              className={s.menuLayer}
              initial={{ opacity: 0, x: menuView === MENU_VIEW.DOC ? 16 : -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: menuView === MENU_VIEW.DOC ? -16 : 16 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {menuView === MENU_VIEW.DOC ? (
                <DocMenu />
              ) : (
                groupKeys.map((key) => <Group key={key} group={MENU[key]} />)
              )}
            </m.div>
          </AnimatePresence>
        </LazyMotion>
      </Sticky>
    </div>
  )
}
