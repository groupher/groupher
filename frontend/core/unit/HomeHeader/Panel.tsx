'use client'

import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import type { FC } from 'react'

import CommunityIntros from './CommunityIntros'
import { HEAD_MENU } from './constant'
import DocsIntros from './DocsIntros'
import FeatureIntros from './FeatureIntros'
import useSalon from './salon/panel'

type TProps = {
  active: string | null
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

const Panel: FC<TProps> = ({ active, onMouseEnter, onMouseLeave }) => {
  const s = useSalon()

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={false}
        className={s.wrapper}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        animate={{
          scaleY: active ? 1 : 0,
          opacity: active ? 1 : 0,
          pointerEvents: active ? 'auto' : 'none',
        }}
        transition={{
          type: 'spring',
          damping: 24,
          stiffness: 250,
          when: active ? 'beforeChildren' : 'afterChildren',
        }}
        style={{ transformOrigin: 'top' }}
      >
        <AnimatePresence mode='wait'>
          {active && (
            <m.div
              key={active}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {active === HEAD_MENU.PRODUCT && <FeatureIntros />}
              {active === HEAD_MENU.COMMUNITY && <CommunityIntros />}
              {active === HEAD_MENU.DOCS && <DocsIntros />}
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </LazyMotion>
  )
}

export default Panel
