'use client'

import {
  motion,
  useMotionTemplate,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react'

import { type FC, type ReactNode, useEffect, useState } from 'react'
import usePageBg from '~/hooks/usePageBg'
import useTopbar from '~/hooks/useTopbar'
import useTrans from '~/hooks/useTrans'

import Footer from '~/widgets/Footer'

import GlowBackground from '~/widgets/GlobalLayout/GlowBackground'
import useSalon from '~/widgets/GlobalLayout/salon/main'

type TProps = {
  children: ReactNode
}

const Main: FC<TProps> = ({ children }) => {
  const s = useSalon()

  /**
   * this is tricky, when client-side changed locale, we force render hte entire app here
   * the action will make sure each component who use useTrans will not need to wrap with observer
   */
  const { locale } = useTrans()
  const { hasTopbar } = useTopbar()
  const { background } = usePageBg()

  const { scrollY } = useScroll()

  const [enabled, setEnabled] = useState(false)
  const [fromWidth, setFromWidth] = useState(0)
  const [toWidth, setToWidth] = useState(0)
  const [scrollRange, setScrollRange] = useState(0)

  useEffect(() => {
    const updateVars = () => {
      const root = document.documentElement
      const computed = getComputedStyle(root)
      const targetWidth = parseInt(computed.getPropertyValue('--container-home-width'), 10) || 1200
      setFromWidth(window.innerWidth)
      setToWidth(targetWidth)
      setScrollRange(window.innerHeight * 1)
    }
    updateVars()
    setEnabled(true) // ✅ 启动 motion 动画

    window.addEventListener('resize', updateVars)
    return () => window.removeEventListener('resize', updateVars)
  }, [])

  // 3️⃣ 滚动进度 → 0~1
  const progress = useTransform(scrollY, [0, scrollRange], [0, 1], { clamp: true })

  // 4️⃣ 平滑滚动插值（防止生硬）
  const smoothProgress = useSpring(progress, {
    stiffness: 500, // 越小越慢，越柔和
    damping: 5, // 越小越有弹性
    mass: 0.1, // 越大惯性越明显
  })

  // 5️⃣ 用数值插值计算宽度（像素级连续变化）
  const widthPx = useTransform(smoothProgress, [0, 1], [fromWidth, toWidth])
  const maxWidth = useMotionTemplate`${widthPx}px`

  useMotionValueEvent(widthPx, 'change', (latest) => {
    document.documentElement.style.setProperty('--container-home-width', `${latest}px`)
  })

  const effectiveMaxWidth = enabled ? maxWidth : '100%'

  return (
    <motion.div
      key={locale}
      className={s.wrapper}
      style={{
        background,
        maxWidth: effectiveMaxWidth,
        transition: enabled ? 'max-width 0.2s ease-out' : undefined,
      }}
    >
      {hasTopbar && <div className={s.topBar} />}
      <div className={s.body}>{children}</div>
      <Footer />
      <GlowBackground />
    </motion.div>
  )
}

export default Main
