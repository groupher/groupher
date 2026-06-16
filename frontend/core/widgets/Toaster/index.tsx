'use client'

import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react'
import { memo, useEffect, useState } from 'react'

import CheckSVG from '~/icons/CheckBold'

import useSalon from './salon'
import type { TToastItem } from './spec'
import { removeToast, subscribeToast, toast } from './store'

const Toaster = () => {
  const s = useSalon()
  const shouldReduceMotion = useReducedMotion()
  const [items, setItems] = useState<TToastItem[]>([])

  useEffect(() => subscribeToast(setItems), [])

  return (
    <LazyMotion features={domAnimation}>
      <div className={s.wrapper}>
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <m.div
              key={item.id}
              className={s.item}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: shouldReduceMotion ? 0.1 : 0.18, ease: 'easeOut' }}
              layout
              role={item.type === 'error' ? 'alert' : 'status'}
            >
              <div className={s.iconBox(item.type)}>
                {item.type === 'success' ? (
                  <CheckSVG className={s.icon} />
                ) : item.type === 'error' ? (
                  '!'
                ) : (
                  'i'
                )}
              </div>
              <div className={s.message}>{item.message}</div>
              <button
                type='button'
                className={s.close}
                aria-label='Close toast'
                onClick={() => removeToast(item.id)}
              >
                <span className={s.closeLine} />
                <span className={s.closeLineInvert} />
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </LazyMotion>
  )
}

export { toast }
export type { TToastInput, TToastItem, TToastOptions, TToastType } from './spec'

export default memo(Toaster)
