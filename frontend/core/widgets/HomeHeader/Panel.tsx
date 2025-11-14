'use client'

import { AnimatePresence, motion } from 'motion/react'
import { type FC, useEffect, useRef } from 'react'
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
  const ref = useRef<HTMLDivElement>(null)

  // ✅ 这里可以用于 hover 容错
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.addEventListener('mouseenter', onMouseEnter || (() => {}))
    node.addEventListener('mouseleave', onMouseLeave || (() => {}))
    return () => {
      node.removeEventListener('mouseenter', onMouseEnter || (() => {}))
      node.removeEventListener('mouseleave', onMouseLeave || (() => {}))
    }
  }, [onMouseEnter, onMouseLeave])

  return (
    <motion.div
      ref={ref}
      initial={false}
      className={s.wrapper}
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
      <div className={s.inner}>
        <AnimatePresence mode='wait'>
          {active && (
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {active === HEAD_MENU.PRODUCT && <FeatureIntros />}
              {active === HEAD_MENU.COMMUNITY && <CommunityIntros />}
              {active === HEAD_MENU.DOCS && <DocsIntros />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default Panel
