'use client'

import { domAnimation, LazyMotion, m, type Variants } from 'motion/react'
import { useEffect } from 'react'

import useDashboard from '~/stores/dashboard/hooks'
import CommunityDigest from '~/unit/CommunityDigest/dashboard-layout'
import { CollapsedSideMenu, SideMenu } from '~/unit/DashboardThread'

import useSalon from './salon'

const ClientLayout = ({ children, demoMode = false }) => {
  const s = useSalon()
  const { commit, sidebarCollapsed, sidebarTransitioning } = useDashboard()
  const sideMenuVariants: Variants = sidebarCollapsed
    ? {
        initial: { x: -48 },
        animate: {
          x: 0,
          transition: { duration: 0.18, ease: 'easeOut' },
        },
      }
    : {
        initial: { opacity: 0, x: -10 },
        animate: {
          opacity: 1,
          x: 0,
          transition: { duration: 0.14, ease: 'easeOut' },
        },
      }

  useEffect(() => {
    if (!sidebarTransitioning) return

    const timer = setTimeout(() => {
      commit({ sidebarTransitioning: false })
    }, 150)

    return () => clearTimeout(timer)
  }, [commit, sidebarTransitioning])

  return (
    <div className={s.wrapper} data-demo-mode={demoMode ? 'true' : 'false'}>
      <div className={s.layoutFrame(sidebarCollapsed)}>
        <CommunityDigest />

        <div className={s.inner}>
          <div className={s.sideMenuClip(sidebarCollapsed)}>
            <LazyMotion features={domAnimation}>
              {!sidebarTransitioning && (
                <m.div
                  key={sidebarCollapsed ? 'collapsed' : 'expanded'}
                  className={s.sideMenuMotion}
                  variants={sideMenuVariants}
                  initial='initial'
                  animate='animate'
                >
                  {sidebarCollapsed ? <CollapsedSideMenu /> : <SideMenu />}
                </m.div>
              )}
            </LazyMotion>
          </div>
          <div className={s.children}>{children}</div>
        </div>
      </div>
    </div>
  )
}

export default ClientLayout
