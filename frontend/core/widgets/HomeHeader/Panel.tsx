'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'

import useSalon from './salon/panel'

interface PanelProps {
  active: string | null
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export default function Panel({ active, onMouseEnter, onMouseLeave }: PanelProps) {
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
      className={s.wrapper}
      animate={{
        scaleY: active ? [0, 1.05, 1] : [1, 0.95, 0],
        opacity: active ? 1 : 0,
        pointerEvents: active ? 'auto' : 'none',
      }}
      transition={{
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <AnimatePresence mode='wait'>
        {active && (
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className='px-24 py-6'
          >
            {active === 'product' && <ProductPanel />}
            {active === 'community' && <MorePanel />}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ---------------------------------
   以下为示例内容，可以自行替换
---------------------------------- */

function ProductPanel() {
  return (
    <div className='grid grid-cols-2 gap-6'>
      <div className='text-sm opacity-80'>讨论区 / 看板 / 更新日志 / 帮助文档</div>
    </div>
  )
}

function MorePanel() {
  return (
    <div className='grid grid-cols-2 gap-6'>
      <div className='text-sm opacity-80'>团队博客 / 帮助文档 / 更新日志 / 自定义</div>
    </div>
  )
}
