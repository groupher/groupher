import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react'
import type { FC } from 'react'

import SIZE from '~/const/size'

import type { TProps } from '.'
import useSalon from './salon'
import { getFontSize } from './salon/metric'

const AnimatedCount: FC<TProps> = ({ count = 0, size = SIZE.SMALL, active = false }) => {
  const s = useSalon({ count, active })
  const reduceMotion = useReducedMotion()

  return (
    <div className={s.wrapper} style={{ fontSize: getFontSize(size), perspective: 400 }}>
      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false} mode='wait'>
          <m.span
            key={count}
            className='inline-block'
            initial={{ opacity: 0, y: '100%', rotateX: -90 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: '-100%', rotateX: 90 }}
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeInOut' }}
            style={{ transformOrigin: 'center' }}
          >
            {count}
          </m.span>
        </AnimatePresence>
      </LazyMotion>
    </div>
  )
}

export default AnimatedCount
